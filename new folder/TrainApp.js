import { useEffect, useMemo, useRef, useState } from "react";
import {
  unlockAudio,
  playCaptainCue,
  preloadCaptainCues,
  onAudio,
  stopAudio,
} from "../lib/audio";
import { listenOnce } from "../lib/speech";
import { prepareScenarioForGrading, scoreWords, diffWords } from "@/lib/scoring";
import { quickScoreDetail } from "@/lib/quickScore";

/**
 * Training simulator UI.
 *
 * Scoring flow overview:
 *   1. Scenario JSON is normalized with prepareScenarioForGrading (handles NATO tails + token metadata).
 *   2. gradeUtterance funnels expected tokens into scoreWords for fuzzy/NATO-aware grading (quickScore fallback via flag).
 *   3. diffWords powers the "Why you got this score" feedback pane.
 */

const ENV = typeof process !== "undefined" ? process.env || {} : {};
const NODE_ENV = typeof process !== "undefined" ? process.env?.NODE_ENV : "production";
const USE_RICH_SCORER = ENV.NEXT_PUBLIC_USE_RICH_SCORER === "false" ? false : true;
const DEBUG_SCORER = ENV.NEXT_PUBLIC_DEBUG_SCORER === "true";
const SHOULD_LOG_SCORER = DEBUG_SCORER || NODE_ENV !== "production";
const SCORE_THRESHOLD = 60;
const LOW_SCORE_PAUSE_THRESHOLD = 30;
const SCORE_OPTIONS = {
  fuzzyThreshold: 0.82,
  enableNATOExpansion: true,
};

const logScoringDebug = (context, transcript, result) => {
  if (!SHOULD_LOG_SCORER) return;
  try {
    console.debug(`[scoring] ${context}`, {
      asrText: transcript,
      totalMatched: result?.totalMatched ?? 0,
      totalExpected: result?.totalExpected ?? 0,
      percent: result?.percent ?? 0,
      first5Matches: (result?.matches || []).slice(0, 5),
    });
  } catch (err) {
    // ignore logging failures
  }
};

function Stepper({ total, current, results = [], onJump }) {
  return (
    <div className="pm-stepper">
      {Array.from({ length: total }).map((_, i) => {
        const r = results[i];
        const cls =
          i === current ? "pm-step cur" : r === true ? "pm-step ok" : r === false ? "pm-step miss" : "pm-step";
        return <button key={i} className={cls} onClick={() => onJump?.(i)} aria-label={`Step ${i + 1}`} />;
      })}
    </div>
  );
}

function ScoreRing({ pct = 0, size = 60, label }) {
  const r = (size - 8) / 2, c = size / 2, circ = 2 * Math.PI * r;
  const off = circ * (1 - pct / 100);
  const display = label ?? `${pct}%`;
  return (
    <svg className="pm-ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle cx={c} cy={c} r={r} stroke="#dfeaff" strokeWidth="8" fill="none" />
      <circle
        cx={c}
        cy={c}
        r={r}
        stroke="#0e63ff"
        strokeWidth="8"
        fill="none"
        strokeDasharray={circ}
        strokeDashoffset={off}
        strokeLinecap="round"
      />
      <text x="50%" y="54%" textAnchor="middle" fontSize="14" fill="#0b1e39">
        {String(display)}
      </text>
    </svg>
  );
}

function WordDiff({ diff, expectedLine = "" }) {
  if (!diff) return null;
  const expectedTokens = diff.expected || [];
  const transcriptTokens = diff.transcript || [];
  return (
    <div className="pm-diffBlock">
      <div className="pm-label">Why you got this score</div>
      <p className="pm-diff">
        {expectedTokens.length ? (
          expectedTokens.map((token, idx) => (
            <span key={`exp-${idx}`} className={token.status === "match" ? "pm-wok" : "pm-wmiss"}>
              {token.display}
              {" "}
            </span>
          ))
        ) : (
          <span className="pm-wmiss">{expectedLine || "—"}</span>
        )}
      </p>
      <p className="pm-diff">
        {transcriptTokens.length ? (
          transcriptTokens.map((token, idx) => (
            <span key={`heard-${idx}`} className={token.status === "match" ? "pm-wok" : "pm-wextra"}>
              {token.display}
              {" "}
            </span>
          ))
        ) : (
          <span className="pm-wmiss">No response captured.</span>
        )}
      </p>
    </div>
  );
}

function MicWidget({ status = "idle", level = 0, compact = false }) {
  const normalized = status || "idle";
  const label = normalized === "manual" ? "Manual entry" : normalized.charAt(0).toUpperCase() + normalized.slice(1);
  return (
    <div className={`pm-mic${compact ? " compact" : ""}`}>
      <span className={`pm-pill${compact ? " pm-pillCompact" : ""}`}>Mic: {label}</span>
      <div className="pm-meter">
        <div className="pm-fill" style={{ width: `${Math.min(100, level)}%` }} />
      </div>
    </div>
  );
}

function StatusDot({ label, state, tone = "idle" }) {
  if (!label) return null;
  const safeState = state || "—";
  return (
    <div className={`pm-statusDot pm-statusDot-${tone}`} aria-label={`${label} status: ${safeState}`}>
      <span className="pm-statusDotIndicator" aria-hidden="true" />
      <span className="pm-statusDotText">
        <span className="pm-statusDotName">{label}</span>
        <span className="pm-statusDotState">{safeState}</span>
      </span>
    </div>
  );
}

function describeMicStatus(status) {
  switch (status) {
    case "listening":
      return { tone: "good", text: "Listening" };
    case "ready":
      return { tone: "good", text: "Ready" };
    case "manual":
      return { tone: "warn", text: "Manual" };
    case "idle":
    default:
      return { tone: "idle", text: "Idle" };
  }
}

function describeAudioStatus(status) {
  switch (status) {
    case "playing":
      return { tone: "good", text: "Playing" };
    case "loading":
      return { tone: "warn", text: "Loading" };
    case "error":
      return { tone: "bad", text: "Error" };
    case "unlocked":
      return { tone: "good", text: "Unlocked" };
    case "ended":
      return { tone: "idle", text: "Ended" };
    case "idle":
    default:
      return { tone: "idle", text: "Idle" };
  }
}

function describeNetworkStatus(status) {
  return status === "offline"
    ? { tone: "bad", text: "Offline" }
    : { tone: "good", text: "Online" };
}

const _toasts = [];
function toast(msg, kind = "info", ms = 2200) {
  _toasts.push({ id: Date.now(), msg, kind });
  renderToasts();
  setTimeout(() => {
    _toasts.shift();
    renderToasts();
  }, ms);
}

function renderToasts() {
  let host = document.getElementById("pm-toast-host");
  if (!host) {
    host = document.createElement("div");
    host.id = "pm-toast-host";
    host.className = "pm-toasts";
    document.body.appendChild(host);
  }
  host.innerHTML = _toasts.map((t) => `<div class="pm-toast ${t.kind}">${t.msg}</div>`).join("");
}

function useResponsiveMode(forcedMode) {
  const pick = () => (window.innerWidth <= 860 ? "mobile" : "desktop");
  const [mode, setMode] = useState(() => {
    if (forcedMode) return forcedMode;
    return typeof window === "undefined" ? "desktop" : pick();
  });

  useEffect(() => {
    if (forcedMode) return;
    const onResize = () => setMode(pick());
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, [forcedMode]);

  useEffect(() => {
    if (forcedMode) setMode(forcedMode);
  }, [forcedMode]);

  return mode;
}

function useViewportSize() {
  const getSize = () => ({
    width: typeof window === "undefined" ? 1024 : window.innerWidth,
    height: typeof window === "undefined" ? 768 : window.innerHeight,
  });
  const [size, setSize] = useState(getSize);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const handle = () => {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    };
    window.addEventListener("resize", handle);
    window.addEventListener("orientationchange", handle);
    return () => {
      window.removeEventListener("resize", handle);
      window.removeEventListener("orientationchange", handle);
    };
  }, []);

  return size;
}

function downloadCSV(rows, filename = "deice-results.csv") {
  const csv = rows.map((r) => r.map((v) => `"${String(v ?? "").replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function TrainApp({ forcedMode }) {
  // scenario list + current
  const [scenarioList, setScenarioList] = useState([]);
  const [preparedScenario, setPreparedScenario] = useState(null);
  const current = preparedScenario;

  // steps / results
  const [stepIndex, setStepIndex] = useState(-1);
  const steps = useMemo(() => current?.steps || [], [current]);
  const total = steps.length;
  const resultsRef = useRef([]);
  const scoresRef = useRef([]);

  // UI & control state
  const [status, setStatus] = useState("Ready");
  const [answer, setAnswer] = useState("");
  const answerRef = useRef("");
  const [lastResultText, setLastResultText] = useState("—");
  const [lastDiff, setLastDiff] = useState(null);
  const [retryCount, setRetryCount] = useState(0);
  const [avgRespSec, setAvgRespSec] = useState(null);
  const [logText, setLogText] = useState("");
  const [autoAdvance, setAutoAdvance] = useState(true);
  const [awaitingAdvance, setAwaitingAdvance] = useState(false);
  const [captureMode, setCaptureMode] = useState(() => {
    if (typeof window === "undefined") return "speech";
    return window.SpeechRecognition || window.webkitSpeechRecognition ? "speech" : "manual";
  });
  const captureModeRef = useRef(captureMode);
  const manualSpeechOverrideRef = useRef(false);
  const [resultsVersion, setResultsVersion] = useState(0);
  const [runState, setRunState] = useState("idle");
  const [isHydrated, setIsHydrated] = useState(false);

  const mode = useResponsiveMode(forcedMode);
  const { width: viewportWidth } = useViewportSize();

  const runningRef = useRef(false);
  const pausedRef = useRef(false);
  const preparedRef = useRef(false);
  const autoAdvanceRef = useRef(autoAdvance);
  const awaitingAdvanceRef = useRef(awaitingAdvance);
  const runIdRef = useRef(0);
  const proceedResolverRef = useRef(null);

  const micLevelRef = useRef(0);
  const [captainStatus, setCaptainStatus] = useState("idle");
  const [networkStatus, setNetworkStatus] = useState(() => {
    if (typeof navigator === "undefined") return "online";
    return navigator.onLine ? "online" : "offline";
  });
  useEffect(() => {
    answerRef.current = answer;
  }, [answer]);

  useEffect(() => {
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    const updateNetwork = () => {
      setNetworkStatus(window.navigator.onLine ? "online" : "offline");
    };
    updateNetwork();
    window.addEventListener("online", updateNetwork);
    window.addEventListener("offline", updateNetwork);
    return () => {
      window.removeEventListener("online", updateNetwork);
      window.removeEventListener("offline", updateNetwork);
    };
  }, []);

  // Scoring pipeline: prefer the rich scorer (lib/scoring) with optional quickScore fallback for debugging.
  const formatScoreSummary = (result) => {
    const percent = result?.percent ?? 0;
    const totalExpected = result?.totalExpected;
    const totalMatched = result?.totalMatched ?? 0;
    if (typeof totalExpected === "number") {
      return `${percent}% — ${totalMatched}/${totalExpected}`;
    }
    return `${percent}%`;
  };

  const gradeUtterance = (step, transcript) => {
    if (!step) {
      return quickScoreDetail("", transcript);
    }
    if (USE_RICH_SCORER) {
      const expectedSource =
        step._expectedForGrade && step._expectedForGrade.length
          ? step._expectedForGrade
          : step._expectedGradeText || step.text || "";
      return scoreWords({
        expected: expectedSource,
        transcript,
        options: SCORE_OPTIONS,
      });
    }
    const fallbackText = step?._expectedGradeText || step?.text || "";
    return quickScoreDetail(fallbackText, transcript);
  };

  useEffect(() => {
    autoAdvanceRef.current = autoAdvance;
    if (autoAdvance && awaitingAdvanceRef.current && proceedResolverRef.current) {
      resolvePrompt();
    }
  }, [autoAdvance]);
  useEffect(() => {
    awaitingAdvanceRef.current = awaitingAdvance;
  }, [awaitingAdvance]);

  useEffect(() => {
    setLastDiff(null);
  }, [stepIndex]);

  const gradedTotal = useMemo(() => (steps || []).filter((s) => s.role === "Iceman").length, [steps]);
  const correct = useMemo(() => {
    return (resultsRef.current || []).reduce((acc, val, idx) => {
      return acc + (steps[idx]?.role === "Iceman" && val === true ? 1 : 0);
    }, 0);
  }, [steps, resultsVersion]);
  const totalScore = useMemo(() => {
    return (scoresRef.current || []).reduce((acc, val, idx) => {
      return acc + (steps[idx]?.role === "Iceman" && typeof val === "number" ? val : 0);
    }, 0);
  }, [steps, resultsVersion]);
  const totalPossible = gradedTotal * 100;
  const pct = totalPossible ? Math.round((totalScore / totalPossible) * 100) : 0;
  const speechSupported = captureMode === "speech";
  const micStatus = speechSupported
    ? preparedRef.current
      ? runningRef.current && !pausedRef.current
        ? "listening"
        : "ready"
      : "idle"
    : "manual";
  const micLevel = micLevelRef.current || 0;
  const activeSpeechLabelId = autoAdvance ? "speech-mode-auto" : "speech-mode-manual";
  const activeRunLabelId = runState === "paused" ? "run-toggle-pause" : "run-toggle-resume";
  const mobileSpeechLabelId = autoAdvance ? "speech-mode-mobile-auto" : "speech-mode-mobile-manual";
  const mobileRunLabelId = runState === "paused" ? "run-toggle-mobile-pause" : "run-toggle-mobile-resume";
  const isMobile = mode === "mobile";
  const micDescriptor = useMemo(() => describeMicStatus(micStatus), [micStatus]);
  const audioDescriptor = useMemo(() => describeAudioStatus(captainStatus), [captainStatus]);
  const networkDescriptor = useMemo(() => describeNetworkStatus(networkStatus), [networkStatus]);
  const mobileScoreSize = useMemo(() => {
    if (!isMobile) return 72;
    const min = 44;
    const max = 56;
    const computed = Math.round((viewportWidth || 0) * 0.15);
    const withinRange = Math.max(min, Math.min(max, computed || min));
    return withinRange;
  }, [isMobile, viewportWidth]);

  const log = (msg) => setLogText((t) => (t ? t + "\n" : "") + msg);

  const pauseForRetry = ({ stepNumber, summary, percent }) => {
    if (pausedRef.current) return;
    pausedRef.current = true;
    runningRef.current = false;
    stopAudio();
    awaitingAdvanceRef.current = false;
    setAwaitingAdvance(false);
    setRunState("paused");
    const statusMsg =
      typeof percent === "number"
        ? `Paused — score ${percent}% on step ${stepNumber}. Retry the line.`
        : "Paused — retry the last line.";
    setStatus(statusMsg);
    const toastMsg = typeof percent === "number" ? `Score ${percent}% — paused for retry.` : "Score too low — paused for retry.";
    toast(toastMsg, "warning");
    log(`[Step ${stepNumber}] ${summary} → auto-paused for retry.`);
  };

  useEffect(() => {
    captureModeRef.current = captureMode;
  }, [captureMode]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hasSpeech = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
    setCaptureMode(hasSpeech ? "speech" : "manual");
    if (!hasSpeech) manualSpeechOverrideRef.current = false;
  }, []);

  useEffect(() => {
    if (captureMode === "manual") {
      manualSpeechOverrideRef.current = false;
      if (autoAdvanceRef.current) {
        autoAdvanceRef.current = false;
      }
      if (autoAdvance) setAutoAdvance(false);
    }
  }, [captureMode, autoAdvance]);

  // 1) Load scenario list for dropdown
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        const res = await fetch("/scenarios/index.json");
        const list = await res.json();
        if (!live) return;
        setScenarioList(list || []);
        if (list && list[0]) {
          // auto-load first scenario
          const res2 = await fetch(`/scenarios/${list[0].id}.json`);
          const data = await res2.json();
          const prepared = prepareScenarioForGrading(data);
          setPreparedScenario(prepared);
          resultsRef.current = Array(prepared.steps.length).fill(undefined);
          scoresRef.current = Array(prepared.steps.length).fill(null);
          setResultsVersion((v) => v + 1);
          setStatus("Scenario loaded");
          setStepIndex(-1);
          setAnswer("");
          setLastResultText("—");
          setLastDiff(null);
          setRetryCount(0);
          setAvgRespSec(null);
          setAwaitingAdvance(false);
          awaitingAdvanceRef.current = false;
          proceedResolverRef.current = null;
          preloadCaptainForScenario(prepared);
          manualSpeechOverrideRef.current = false;
        }
      } catch (e) {
        console.error("Load scenario list failed", e);
      }
    })();
    return () => {
      live = false;
    };
  }, []);

  // 2) subscribe to captain audio status
  useEffect(() => {
    const off = onAudio("status", (e) => setCaptainStatus(e.detail?.status || "idle"));
    return () => off && off();
  }, []);

  // mic level mock
  useEffect(() => {
    const id = setInterval(() => {
      if (captureModeRef.current !== "speech") {
        micLevelRef.current = 0;
        return;
      }
      micLevelRef.current = runningRef.current && !pausedRef.current ? 10 + Math.round(Math.random() * 80) : 0;
    }, 500);
    return () => clearInterval(id);
  }, []);

  function preloadCaptainForScenario(scn) {
    const scnId = scn?.id;
    if (!scnId) return;
    const cues = Array.from(new Set((scn.steps || []).filter((s) => s.role === "Captain" && s.cue).map((s) => s.cue)));
    preloadCaptainCues(scnId, cues);
  }

  async function prepareMic() {
    if (preparedRef.current) {
      log("Microphone already prepared.");
      return true;
    }

    setStatus("Preparing mic…");
    log("Preparing microphone.");
    let speechModeActive = captureModeRef.current === "speech";
    const manualReadyStatus = "Ready (manual)";
    if (typeof window !== "undefined") {
      const hasSpeech = Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
      if (!hasSpeech) {
        speechModeActive = false;
        if (captureModeRef.current !== "manual") setCaptureMode("manual");
        manualSpeechOverrideRef.current = false;
      }
    }
    try {
      await unlockAudio();
      log("Audio unlocked via unlockAudio().");

      if (speechModeActive) {
        if (navigator.mediaDevices?.getUserMedia) {
          await navigator.mediaDevices.getUserMedia({ audio: true });
          log("Mic permission granted by getUserMedia().");
        } else {
          log("getUserMedia unavailable; switching to manual capture mode.");
          setCaptureMode("manual");
          manualSpeechOverrideRef.current = false;
          speechModeActive = false;
        }
      } else {
        log("Speech capture not supported; running in manual mode.");
      }

      const cues = (current?.steps || []).filter((s) => s.role === "Captain" && s.cue).map((s) => s.cue);
      if (cues.length) {
        preloadCaptainCues(current?.id || "default", cues);
        log(`Preloaded Captain cues: ${cues.join(", ")}`);
      }

      preparedRef.current = true;
      setStatus(speechModeActive ? "Mic ready" : manualReadyStatus);
      toast(speechModeActive ? "Mic ready" : "Manual mode ready", "success");
      return true;
    } catch (err) {
      log(`Prepare Mic ERROR: ${err?.message || err}`);
      if (speechModeActive) {
        if (captureModeRef.current !== "manual") setCaptureMode("manual");
        captureModeRef.current = "manual";
        manualSpeechOverrideRef.current = false;
        preparedRef.current = true;
        setStatus(manualReadyStatus);
        toast("Mic unavailable — manual mode ready", "warning");
        return true;
      }
      preparedRef.current = true;
      setStatus(manualReadyStatus);
      toast("Manual mode ready", "info");
      return true;
    }
  }

  async function onStart() {
    try {
      const ok = await prepareMic();
      if (!ok) return;

      if (captureModeRef.current === "speech" && !autoAdvanceRef.current && !manualSpeechOverrideRef.current) {
        autoAdvanceRef.current = true;
        setAutoAdvance(true);
      }

      pausedRef.current = false;
      runningRef.current = true;
      setRunState("running");
      setStatus(preparedRef.current ? "Running…" : "Running (no mic)");
      log("Simulation started.");

      // First start: move to step 0 if needed
      if (stepIndex < 0 && steps.length) {
        setStepIndex(0);
      }

      runSimulator();
    } catch (e) {
      console.error("Start failed:", e);
      setStatus("Start failed");
      setRunState("idle");
      toast("Start failed", "error");
    }
  }

  // Pause simulator and all audio cleanly
  function onPause() {
    try {
      pausedRef.current = true;
      runningRef.current = false;
      stopAudio();
      resolvePrompt({ silent: true });
      setStatus("Paused");
      setRunState("paused");
      log("Simulation paused.");
      toast("Paused", "info");
    } catch (e) {
      console.error("Pause failed:", e);
      toast("Pause failed", "error");
    }
  }

  function onResume() {
    try {
      pausedRef.current = false;
      runningRef.current = true;
      setRunState("running");
      setStatus(preparedRef.current ? "Running…" : "Running (no mic)");
      log("Simulation resumed.");
      toast("Resumed", "success");
      runSimulator();
    } catch (e) {
      console.error("Resume failed:", e);
      setRunState("paused");
      toast("Resume failed", "error");
    }
  }

  async function onRestart() {
    try {
      stopAudio();
      resolvePrompt({ silent: true });
      runningRef.current = false;
      pausedRef.current = false;
      runIdRef.current = Date.now();
      setRunState("idle");
      setStatus("Restarting…");
      log("Restarting simulation.");
      setAnswer("");
      setLastResultText("—");
      setLastDiff(null);
      setRetryCount(0);
      setAvgRespSec(null);
      setAwaitingAdvance(false);
      awaitingAdvanceRef.current = false;
      proceedResolverRef.current = null;
      resultsRef.current = Array(steps.length).fill(undefined);
      scoresRef.current = Array(steps.length).fill(null);
      setResultsVersion((v) => v + 1);
      setStepIndex(-1);
      toast("Restarting…", "info");
      await onStart();
    } catch (e) {
      console.error("Restart failed:", e);
      toast("Restart failed", "error");
    }
  }

  function onCheck() {
    if (stepIndex < 0 || !steps[stepIndex]) return;
    const step = steps[stepIndex];
    const heard = (answer || "").trim();
    const result = gradeUtterance(step, heard);
    const percent = result?.percent ?? 0;
    const ok = percent >= SCORE_THRESHOLD;
    const summary = formatScoreSummary(result);
    resultsRef.current[stepIndex] = ok;
    scoresRef.current[stepIndex] = percent;
    setResultsVersion((v) => v + 1);
    const diff = diffWords(result);
    setLastDiff(diff);
    setLastResultText(ok ? `✅ Good (${summary})` : `❌ Try again (${summary})`);
    if (!ok) setRetryCount((n) => n + 1);
    log(`[Step ${stepIndex + 1}] Score ${summary} → ${ok ? "OK" : "MISS"}`);
    logScoringDebug(`manual-check-${stepIndex + 1}`, heard, result);
  }

  function exportSession() {
    const rows = [
      ["Scenario", current?.label || ""],
      [],
      ["Step", "Role", "Expected", "Result"],
      ...steps.map((s, i) => [i + 1, s.role, s.text, resultsRef.current[i] ? "OK" : "MISS"]),
    ];
    downloadCSV(rows, `deice_${current?.id || "scenario"}.csv`);
    toast("CSV downloaded", "success");
  }

  function resolvePrompt({ silent = false } = {}) {
    const hadPending = Boolean(proceedResolverRef.current) || awaitingAdvanceRef.current;
    if (proceedResolverRef.current) {
      const resolve = proceedResolverRef.current;
      proceedResolverRef.current = null;
      resolve();
    }
    awaitingAdvanceRef.current = false;
    setAwaitingAdvance(false);
    if (hadPending && !silent && runningRef.current && !pausedRef.current) setStatus("Running…");
  }

  async function runSimulator() {
    if (!current || !steps.length) {
      setStatus("Select a scenario first.");
      runningRef.current = false;
      pausedRef.current = false;
      setRunState("idle");
      return;
    }

    const runId = Date.now();
    runIdRef.current = runId;

    let idx = stepIndex >= 0 ? stepIndex : 0;
    if (idx !== stepIndex) setStepIndex(idx);

    let responseCount = 0;
    let responseTotal = 0;

    const awaitManualResponse = async (step) => {
      setAnswer("");
      setStatus("Type your line and tap Proceed…");
      log(`[Step ${idx + 1}] Manual response mode.`);

      const started = performance.now();
      awaitingAdvanceRef.current = true;
      setAwaitingAdvance(true);

      await new Promise((resolve) => {
        proceedResolverRef.current = () => {
          const heard = (answerRef.current || "").trim();
          const result = gradeUtterance(step, heard);
          const percent = result?.percent ?? 0;
          const ok = percent >= SCORE_THRESHOLD;
          const summary = formatScoreSummary(result);
          resultsRef.current[idx] = ok;
          scoresRef.current[idx] = percent;
          setResultsVersion((v) => v + 1);
          const diff = diffWords(result);
          setLastDiff(diff);
          setLastResultText(ok ? `✅ Good (${summary})` : `❌ Try again (${summary})`);
          const severeMiss = step?.role === "Iceman" && percent < LOW_SCORE_PAUSE_THRESHOLD;
          if (!ok) {
            setRetryCount((n) => n + 1);
            if (!severeMiss) {
              toast("Let's try that line again.", "info");
            }
          }
          const took = (performance.now() - started) / 1000;
          responseCount += 1;
          responseTotal += took;
          setAvgRespSec(responseCount ? responseTotal / responseCount : null);
          log(`[Step ${idx + 1}] Manual score ${summary} → ${ok ? "OK" : "MISS"}`);
          logScoringDebug(`manual-step-${idx + 1}`, heard, result);
          if (severeMiss) {
            pauseForRetry({ stepNumber: idx + 1, summary, percent });
          }
          resolve();
        };
      });

      return runningRef.current && !pausedRef.current && runIdRef.current === runId;
    };

    while (runningRef.current && !pausedRef.current && runIdRef.current === runId && idx < steps.length) {
      const step = steps[idx];
      if (!step) break;

      setStepIndex(idx);

      if (step.role === "Captain") {
        if (step.cue && current?.id) {
          try {
            await playCaptainCue(current.id, step.cue);
          } catch (err) {
            console.error("Captain cue failed", err);
          }
        }
        if (resultsRef.current[idx] !== true) {
          resultsRef.current[idx] = true;
          setResultsVersion((v) => v + 1);
        }
      } else if (step.role === "Iceman") {
        if (captureModeRef.current !== "speech") {
          const shouldContinue = await awaitManualResponse(step);
          if (!shouldContinue) break;
          if (!runningRef.current || pausedRef.current || runIdRef.current !== runId) break;
          if (runningRef.current && !pausedRef.current) setStatus("Running…");
          idx += 1;
          continue;
        }

        setAnswer("");
        setStatus("Listening…");
        log(`[Step ${idx + 1}] Listening for response.`);

        const started = performance.now();
        let speech;
        try {
          speech = await listenOnce({
            onInterim: (txt) => setAnswer(txt),
            onStatus: (msg) => setStatus(msg),
          });
        } catch (err) {
          console.error("listenOnce failed", err);
          toast("Speech capture failed", "error");
          setStatus("Speech capture failed");
          runningRef.current = false;
          pausedRef.current = false;
          setRunState("idle");
          break;
        }

        if (!runningRef.current || pausedRef.current || runIdRef.current !== runId) break;

        if (speech?.ended === "nosr") {
          log("Speech recognition unavailable; switching to manual mode.");
          toast("Speech capture not supported in this browser. Using manual mode.", "info");
          setCaptureMode("manual");
          manualSpeechOverrideRef.current = false;
          const shouldContinue = await awaitManualResponse(step);
          if (!shouldContinue) break;
          if (!runningRef.current || pausedRef.current || runIdRef.current !== runId) break;
          if (runningRef.current && !pausedRef.current) setStatus("Running…");
          idx += 1;
          continue;
        }

        const heard = (speech?.final || speech?.interim || "").trim();
        setAnswer(heard);

        const took = (performance.now() - started) / 1000;
        responseCount += 1;
        responseTotal += took;
        setAvgRespSec(responseCount ? responseTotal / responseCount : null);

        const result = gradeUtterance(step, heard);
        const percent = result?.percent ?? 0;
        const ok = percent >= SCORE_THRESHOLD;
        const summary = formatScoreSummary(result);
        const severeMiss = step?.role === "Iceman" && percent < LOW_SCORE_PAUSE_THRESHOLD;
        resultsRef.current[idx] = ok;
        scoresRef.current[idx] = percent;
        setResultsVersion((v) => v + 1);
        const diff = diffWords(result);
        setLastDiff(diff);
        setLastResultText(ok ? `✅ Good (${summary})` : `❌ Try again (${summary})`);
        if (!ok) {
          setRetryCount((n) => n + 1);
          if (!severeMiss) {
            toast("Let's try that line again.", "info");
          }
        }
        log(`[Step ${idx + 1}] Auto score ${summary} → ${ok ? "OK" : "MISS"}`);
        logScoringDebug(`auto-step-${idx + 1}`, heard, result);

        if (severeMiss) {
          pauseForRetry({ stepNumber: idx + 1, summary, percent });
          break;
        }

        if (!autoAdvanceRef.current && idx < steps.length - 1) {
          setStatus("Awaiting proceed…");
          awaitingAdvanceRef.current = true;
          setAwaitingAdvance(true);
          log("Awaiting confirmation to proceed.");
          await new Promise((resolve) => {
            proceedResolverRef.current = resolve;
          });
          proceedResolverRef.current = null;
          awaitingAdvanceRef.current = false;
          setAwaitingAdvance(false);
          if (!runningRef.current || pausedRef.current || runIdRef.current !== runId) break;
          setStatus("Running…");
        }
      } else {
        if (resultsRef.current[idx] === undefined) {
          resultsRef.current[idx] = true;
          setResultsVersion((v) => v + 1);
        }
      }

      if (!runningRef.current || pausedRef.current || runIdRef.current !== runId) break;

      if (runningRef.current && !pausedRef.current) setStatus("Running…");
      idx += 1;
    }

    if (runIdRef.current !== runId) return;

    if (idx >= steps.length) {
      runningRef.current = false;
      pausedRef.current = false;
      setRunState("idle");
      const okCount = (resultsRef.current || []).reduce((acc, val, i) => {
        return acc + (steps[i]?.role === "Iceman" && val === true ? 1 : 0);
      }, 0);
      const finalPct = gradedTotal ? Math.round((okCount / gradedTotal) * 100) : 0;
      setStatus(`Complete • ${okCount}/${gradedTotal} (${finalPct}%) • ${finalPct >= 80 ? "PASS" : "RETRY"}`);
      toast("Session complete", finalPct >= 80 ? "success" : "info");
    }
  }

  const scoreDetails = (
    <div className="pm-scoreDetails">
      <div className="pm-pill">
        Correct: <strong>{correct}/{gradedTotal}</strong>
      </div>
      <div className="pm-pill">
        Retries: <strong>{retryCount || 0}</strong>
      </div>
      <div className="pm-pill">
        Avg. Response: <strong>{avgRespSec?.toFixed?.(1) ?? "—"}s</strong>
      </div>
    </div>
  );

  const progressSummary = (
    <div className="pm-row pm-progressRow">
      <div>
        <div className="pm-label">Progress</div>
        <Stepper
          total={total}
          current={Math.max(0, stepIndex)}
          results={resultsRef.current || []}
          onJump={(i) => {
            resolvePrompt({ silent: true });
            setStepIndex(i);
            const s = steps[i];
            if (s?.role === "Captain" && s.cue && current?.id) playCaptainCue(current.id, s.cue);
          }}
        />
      </div>
      <div className={`pm-scoreRow${isMobile ? " pm-scoreRowCompact" : ""}`}>
        {!isMobile && <ScoreRing pct={pct} />}
        {scoreDetails}
      </div>
    </div>
  );

  const titleBlock = (
    <div className="pm-title">
      <div className="pm-titleBrand">
        <img src="/images/piedmont-logo.png" alt="Piedmont Airlines" />
        <div className="pm-titleText">
          <h1>Deice Verbiage Trainer</h1>
          <span className="pm-badge pm-titleBadge">V2 • For training purposes only • OMA Station • 2025</span>
        </div>
      </div>
    </div>
  );

  const totalScoreText = totalPossible ? `${pct}% (${totalScore} of ${totalPossible})` : `${pct}%`;
  const scoreBlock = (
    <div className="pm-headerScore" aria-label={`Iceman total ${totalScoreText}`}>
      <ScoreRing pct={pct} size={isMobile ? mobileScoreSize : 60} />
    </div>
  );

  const statusBlock = (
    <div className={`pm-statusGroup${isMobile ? " pm-statusGroupCompact" : ""}`}>
      <span className="pm-pill pm-pillCompact">{status}</span>
      <span className="pm-pill pm-pillCompact">Captain: {captainStatus}</span>
    </div>
  );

  const micBlock = isMobile ? null : <MicWidget status={micStatus} level={micLevel} />;
  const cardClassName = `pm-card${isMobile ? " pm-cardMobile" : ""}`;
  const startButtonLabel = runState === "paused" ? "Resume" : "Start";
  const isStartDisabled = runState === "running";
  const isPauseDisabled = runState !== "running";
  const handleStartPress = () => {
    if (runState === "paused") {
      onResume();
    } else if (runState === "idle") {
      onStart();
    }
  };
  const handlePausePress = () => {
    if (runState === "running") {
      onPause();
    }
  };
  const placeholderDot = { tone: "idle", text: "—" };
  const micDot = isHydrated ? micDescriptor : placeholderDot;
  const audioDot = isHydrated ? audioDescriptor : placeholderDot;
  const networkDot = isHydrated ? networkDescriptor : placeholderDot;
  const microHeader = (
    <div className={`pm-microHeader${isMobile ? " mobile" : ""}`}>
      <StatusDot label="Mic" state={micDot.text} tone={micDot.tone} />
      <StatusDot label="Audio" state={audioDot.text} tone={audioDot.tone} />
      <StatusDot label="Network" state={networkDot.text} tone={networkDot.tone} />
    </div>
  );
  const controlRail = isMobile ? null : (
    <div className="pm-runRow">
      <div className="pm-controlBlock">
        <span className="pm-label">Start</span>
        <button type="button" className="pm-btn" onClick={onStart}>
          Start
        </button>
      </div>
      <div className="pm-controlBlock">
        <span className="pm-label">Restart</span>
        <button type="button" className="pm-btn ghost" onClick={onRestart}>
          Restart
        </button>
      </div>
      <div className="pm-controlBlock">
        <span className="pm-label" id="run-toggle-label">
          Run control
        </span>
        <div className="pm-runToggle">
          <span id="run-toggle-resume" className={`pm-switchOption${runState === "paused" ? "" : " active"}`}>
            Resume
          </span>
          <button
            type="button"
            className={`pm-switch${runState === "paused" ? " on" : ""}`}
            role="switch"
            aria-checked={runState === "paused"}
            aria-labelledby={`run-toggle-label ${activeRunLabelId}`}
            disabled={runState === "idle"}
            onClick={() => {
              if (runState === "running") {
                onPause();
              } else if (runState === "paused") {
                onResume();
              }
            }}
          >
            <span className="pm-switchTrack">
              <span className="pm-switchThumb" />
            </span>
          </button>
          <span id="run-toggle-pause" className={`pm-switchOption${runState === "paused" ? " active" : ""}`}>
            Pause
          </span>
        </div>
      </div>
      <div className="pm-controlBlock">
        <span className="pm-label" id="speech-mode-label">
          Speech mode
        </span>
        <div className="pm-speechToggle">
          <span id="speech-mode-auto" className={`pm-switchOption${autoAdvance ? " active" : ""}`}>
            Auto
          </span>
          <button
            type="button"
            className={`pm-switch${autoAdvance ? "" : " manual"}`}
            role="switch"
            aria-checked={!autoAdvance}
            aria-labelledby={`speech-mode-label ${activeSpeechLabelId}`}
            disabled={captureMode !== "speech"}
            onClick={() => {
              if (captureMode !== "speech") return;
              manualSpeechOverrideRef.current = true;
              const next = !autoAdvance;
              setAutoAdvance(next);
              log(`Speech mode: ${next ? "Auto" : "Manual"}.`);
            }}
          >
            <span className="pm-switchTrack">
              <span className="pm-switchThumb" />
            </span>
          </button>
          <span id="speech-mode-manual" className={`pm-switchOption${autoAdvance ? "" : " active"}`}>
            Manual
          </span>
        </div>
      </div>
    </div>
  );

  const mobileActionBar = isMobile ? (
    <div className="pm-mobileActionBar">
      <button
        type="button"
        className="pm-thumbBtn start"
        onClick={handleStartPress}
        disabled={isStartDisabled}
        aria-label={startButtonLabel === "Resume" ? "Resume training" : "Start training"}
      >
        {startButtonLabel}
      </button>
      <button
        type="button"
        className="pm-thumbBtn pause"
        onClick={handlePausePress}
        disabled={isPauseDisabled}
        aria-label="Pause training"
      >
        Pause
      </button>
      <div className="pm-thumbToggle">
        <span className="pm-thumbLabel" id="run-toggle-label-mobile">
          Run control
        </span>
        <div className="pm-runToggle pm-runToggleThumb">
          <span
            id="run-toggle-mobile-resume"
            className={`pm-switchOption${runState === "paused" ? "" : " active"}`}
          >
            Resume
          </span>
          <button
            type="button"
            className={`pm-switch${runState === "paused" ? " on" : ""}`}
            role="switch"
            aria-checked={runState === "paused"}
            aria-labelledby={`run-toggle-label-mobile ${mobileRunLabelId}`}
            disabled={runState === "idle"}
            onClick={() => {
              if (runState === "running") {
                onPause();
              } else if (runState === "paused") {
                onResume();
              }
            }}
          >
            <span className="pm-switchTrack">
              <span className="pm-switchThumb" />
            </span>
          </button>
          <span
            id="run-toggle-mobile-pause"
            className={`pm-switchOption${runState === "paused" ? " active" : ""}`}
          >
            Pause
          </span>
        </div>
      </div>
      <div className="pm-thumbToggle">
        <span className="pm-thumbLabel" id="speech-mode-label-mobile">
          Speech mode
        </span>
        <div className="pm-speechToggle pm-speechToggleThumb">
          <span
            id="speech-mode-mobile-auto"
            className={`pm-switchOption${autoAdvance ? " active" : ""}`}
          >
            Auto
          </span>
          <button
            type="button"
            className={`pm-switch${autoAdvance ? "" : " manual"}`}
            role="switch"
            aria-checked={!autoAdvance}
            aria-labelledby={`speech-mode-label-mobile ${mobileSpeechLabelId}`}
            disabled={captureMode !== "speech"}
            onClick={() => {
              if (captureMode !== "speech") return;
              manualSpeechOverrideRef.current = true;
              const next = !autoAdvance;
              setAutoAdvance(next);
              log(`Speech mode: ${next ? "Auto" : "Manual"}.`);
            }}
          >
            <span className="pm-switchTrack">
              <span className="pm-switchThumb" />
            </span>
          </button>
          <span
            id="speech-mode-mobile-manual"
            className={`pm-switchOption${autoAdvance ? "" : " active"}`}
          >
            Manual
          </span>
        </div>
      </div>
    </div>
  ) : null;

  return (
    <div className={`pm-app ${mode}`}>
      <div className={cardClassName}>
        {microHeader}
        {/* Header */}
        {isMobile ? (
          <div className="pm-header mobile">
            <div className="pm-headerSection pm-headerBrand">{titleBlock}</div>
            <div className="pm-headerSection pm-headerScoreWrap">{scoreBlock}</div>
            {micBlock && <div className="pm-headerSection pm-headerMic">{micBlock}</div>}
          </div>
        ) : (
          <div className="pm-header desktop">
            <div className="pm-headerLeft">
              {titleBlock}
              {scoreBlock}
            </div>
            <div className="pm-headerRight">
              {statusBlock}
              {micBlock}
            </div>
          </div>
        )}

        <div className={`pm-panel pm-scenarioPanel${isMobile ? " mobile" : ""}`}>
          <label className="pm-srOnly" htmlFor="scenario-select">
            Scenario
          </label>
          <select
            id="scenario-select"
            className="pm-select pm-scenarioSelect"
            value={current?.id || ""}
            size={1}
            onChange={async (e) => {
              const id = e.target.value;
              const res = await fetch(`/scenarios/${id}.json`);
              const scn = await res.json();
              const prepared = prepareScenarioForGrading(scn);
              setPreparedScenario(prepared);
              resultsRef.current = Array(prepared.steps.length).fill(undefined);
              scoresRef.current = Array(prepared.steps.length).fill(null);
              setResultsVersion((v) => v + 1);
              setStepIndex(-1);
              setStatus("Scenario loaded");
              log(`Scenario loaded: ${prepared.label}`);
              stopAudio();
              resolvePrompt({ silent: true });
              runningRef.current = false;
              pausedRef.current = false;
              setRunState("idle");
              setAnswer("");
              setLastResultText("—");
              setLastDiff(null);
              setRetryCount(0);
              setAvgRespSec(null);
              setAwaitingAdvance(false);
              awaitingAdvanceRef.current = false;
              proceedResolverRef.current = null;
              preloadCaptainForScenario(prepared);
              manualSpeechOverrideRef.current = false;
            }}
          >
            {(scenarioList || []).map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Main */}
        <div className={`pm-main ${mode}`}>
          {/* LEFT */}
          <section className="pm-panel">
            {isMobile && <div className="pm-progressTop">{progressSummary}</div>}
            {controlRail}

            {captureMode !== "speech" && (
              <div className="pm-manualNotice">
                <span className="pm-pill pm-pillWarn">
                  Speech capture isn't available on this device. Type your response and use Proceed.
                </span>
              </div>
            )}

            <div style={{ marginTop: 10 }}>
              <div className="pm-label">Current Line</div>
              <div className="pm-coach">
                {stepIndex >= 0 && steps[stepIndex] ? (
                  <>
                    <strong>{steps[stepIndex].role}:</strong> {steps[stepIndex].text}
                  </>
                ) : (
                  "Select a step and press Start."
                )}
              </div>
            </div>

            <div
              className={`pm-row pm-navRow${isMobile ? " pm-navRowCompact" : ""}`}
              style={{ marginTop: 8 }}
            >
              <button
                className={`pm-btn${isMobile ? " pm-mobileNavBtn" : ""}`}
                onClick={() => {
                  resolvePrompt({ silent: true });
                  setStepIndex((i) => {
                    const n = Math.max(0, (typeof i === "number" ? i : 0) - 1);
                    const s = steps[n];
                    if (s?.role === "Captain" && s.cue && current?.id) playCaptainCue(current.id, s.cue);
                    return n;
                  });
                }}
              >
                ⟵ Prev
              </button>
              <button
                className={`pm-btn primary${isMobile ? " pm-mobileNavBtn" : ""}`}
                onClick={() => {
                  if (awaitingAdvanceRef.current) {
                    log("Advance confirmed via Next button.");
                    resolvePrompt();
                    return;
                  }
                  setStepIndex((i) => {
                    const n = Math.min(total - 1, (typeof i === "number" ? i : -1) + 1);
                    const s = steps[n];
                    if (s?.role === "Captain" && s.cue && current?.id) playCaptainCue(current.id, s.cue);
                    return n;
                  });
                }}
              >
                Next ⟶
              </button>
              <button
                className={`pm-btn${isMobile ? " pm-mobileNavBtn" : ""}`}
                onClick={() => {
                  const s = steps[stepIndex];
                  if (s?.role === "Captain" && s.cue && current?.id) playCaptainCue(current.id, s.cue);
                }}
              >
                ▶︎ Play line
              </button>
            </div>

            <div style={{ marginTop: 10 }}>
              <div className="pm-label">Your Response</div>
              <textarea
                rows={3}
                className="pm-input"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                placeholder="Speak or type your line…"
              />
              <div className="pm-row pm-checkRow" style={{ marginTop: 6 }}>
                <button className="pm-btn" onClick={onCheck}>
                  Check
                </button>
                <span className="pm-pill">{lastResultText}</span>
              </div>
            </div>

            {awaitingAdvance && (
              <div className="pm-row pm-awaitRow" style={{ marginTop: 8 }}>
                <span className="pm-pill">Response captured. Proceed when ready.</span>
                <button
                  className="pm-btn primary"
                  onClick={() => {
                    log("Advance confirmed.");
                    resolvePrompt();
                  }}
                >
                  Proceed
                </button>
              </div>
            )}

            {stepIndex >= 0 && steps[stepIndex] && (
              <WordDiff
                diff={lastDiff}
                expectedLine={steps[stepIndex]._displayLine || steps[stepIndex].text || ""}
              />
            )}
          </section>

          {/* RIGHT */}
          <section className="pm-panel">
            {!isMobile && progressSummary}

            {!isMobile && (
              <div style={{ marginTop: 10 }}>
                <div className="pm-label">Session Log</div>
                <div className="pm-log">{logText}</div>
              </div>
            )}

            <div className="pm-row pm-exportRow" style={{ marginTop: 10 }}>
              <button className="pm-btn ghost" onClick={exportSession}>
                Export CSV
              </button>
              <button className="pm-btn ghost" onClick={() => toast("Saved settings", "success")}>
                Save Settings
              </button>
            </div>
          </section>
        </div>

        {mobileActionBar}

        {/* Footer */}
        <div className="pm-footer">
          <div>V2 • For training purposes only • OMA Station • 2025 • Microphone works only in Safari on iOS</div>
          <div className="pm-pill">Tip: Use headphones to avoid feedback.</div>
        </div>
      </div>
    </div>
  );
}

export function DesktopTrainApp() {
  return <TrainApp forcedMode="desktop" />;
}

export function MobileTrainApp() {
  return <TrainApp forcedMode="mobile" />;
}

export default TrainApp;
