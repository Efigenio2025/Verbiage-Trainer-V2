'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import clsx from 'clsx';
import PolarCard from '@/components/PolarCard';
import { createCsv, downloadCsv } from '@/lib/deice/csv';
import {
  preloadCaptainCues,
  playCaptainCue,
  stopAudio,
  unlockAudioContext
} from '@/lib/deice/audio';
import { prepareScenarioForGrading } from '@/lib/deice/scenario';
import { gradeUtterance } from '@/lib/deice/scoring';
import { listenOnce } from '@/lib/deice/speech';
import type {
  CaptureMode,
  GradeOptions,
  PreparedScenario,
  ScenarioFile,
  ScenarioLogEntry,
  ScenarioManifest,
  ScenarioManifestEntry,
  TrainerState,
  UtteranceScore
} from '@/lib/deice/types';

const PASS_THRESHOLD = 60;
const PAUSE_THRESHOLD = 30;
const MAX_DURATION = 15000;

const initialTrainerState: TrainerState = {
  status: 'initializing',
  mode: 'speech',
  scenario: null,
  stepIndex: 0,
  log: [],
  retries: {},
  scores: {},
  interimTranscript: '',
  activeSessionId: null
};

type TrainerAction =
  | { type: 'setScenario'; scenario: PreparedScenario }
  | { type: 'status'; status: TrainerState['status'] }
  | { type: 'setMode'; mode: CaptureMode }
  | { type: 'setStep'; stepIndex: number }
  | { type: 'appendLog'; entry: ScenarioLogEntry }
  | { type: 'batchAppendLogs'; entries: ScenarioLogEntry[] }
  | { type: 'setInterim'; transcript: string }
  | { type: 'setScore'; stepIndex: number; score: UtteranceScore | null }
  | { type: 'incrementRetry'; stepIndex: number }
  | { type: 'resetRun' }
  | { type: 'setSession'; sessionId: string | null };

function trainerReducer(state: TrainerState, action: TrainerAction): TrainerState {
  switch (action.type) {
    case 'setScenario': {
      const blankScores: Record<number, UtteranceScore | null> = {};
      action.scenario.steps.forEach((step) => {
        blankScores[step.index] = null;
      });

      return {
        ...state,
        scenario: action.scenario,
        status: 'ready',
        stepIndex: 0,
        scores: blankScores,
        retries: {},
        interimTranscript: '',
        activeSessionId: null,
        log: [],
        mode: state.mode
      };
    }
    case 'status':
      return { ...state, status: action.status };
    case 'setMode':
      return { ...state, mode: action.mode };
    case 'setStep':
      return { ...state, stepIndex: action.stepIndex, interimTranscript: '' };
    case 'appendLog':
      return { ...state, log: [...state.log, action.entry].slice(-150) };
    case 'batchAppendLogs':
      return { ...state, log: [...state.log, ...action.entries].slice(-150) };
    case 'setInterim':
      return { ...state, interimTranscript: action.transcript };
    case 'setScore':
      return {
        ...state,
        scores: {
          ...state.scores,
          [action.stepIndex]: action.score
        }
      };
    case 'incrementRetry':
      return {
        ...state,
        retries: {
          ...state.retries,
          [action.stepIndex]: (state.retries[action.stepIndex] ?? 0) + 1
        }
      };
    case 'resetRun': {
      if (!state.scenario) {
        return state;
      }
      const blank: Record<number, UtteranceScore | null> = {};
      state.scenario.steps.forEach((step) => {
        blank[step.index] = null;
      });
      return {
        ...state,
        status: 'ready',
        stepIndex: 0,
        scores: blank,
        retries: {},
        interimTranscript: '',
        activeSessionId: null
      };
    }
    case 'setSession':
      return { ...state, activeSessionId: action.sessionId };
    default:
      return state;
  }
}

function createLog(level: ScenarioLogEntry['level'], message: string): ScenarioLogEntry {
  return { at: Date.now(), level, message };
}

function generateSessionId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `session-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isCaptainStep(step: PreparedScenario['steps'][number]) {
  return step.role === 'captain';
}

function isIcemanStep(step: PreparedScenario['steps'][number]) {
  return step.role === 'iceman';
}

export default function TrainApp() {
  const [state, dispatch] = useReducer(trainerReducer, initialTrainerState);
  const [manifest, setManifest] = useState<ScenarioManifestEntry[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [loadingScenario, setLoadingScenario] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualTranscript, setManualTranscript] = useState('');
  const [capturing, setCapturing] = useState(false);
  const sessionRef = useRef<string | null>(null);

  useEffect(() => {
    sessionRef.current = state.activeSessionId;
  }, [state.activeSessionId]);

  const gradeOptions: GradeOptions = useMemo(
    () => ({
      passThreshold: PASS_THRESHOLD,
      pauseThreshold: PAUSE_THRESHOLD,
      enableFuzzy: true,
      enableNato: true
    }),
    []
  );

  const loadScenario = useCallback(
    async (scenarioId: string) => {
      setLoadingScenario(true);
      setError(null);
      dispatch({ type: 'status', status: 'initializing' });
      try {
        const response = await fetch(`/scenarios/${scenarioId}.json`);
        if (!response.ok) {
          throw new Error(`Scenario ${scenarioId} returned ${response.status}`);
        }
        const data = (await response.json()) as ScenarioFile;
        const prepared = prepareScenarioForGrading(data);
        dispatch({ type: 'setScenario', scenario: prepared });
        dispatch(
          { type: 'appendLog', entry: createLog('info', `Scenario "${prepared.label}" loaded`) }
        );
        if (prepared.captainCues.length) {
          const logs = await preloadCaptainCues(prepared.id, prepared.captainCues);
          if (logs.length) {
            dispatch({ type: 'batchAppendLogs', entries: logs });
          }
        }
        dispatch({ type: 'status', status: 'ready' });
        setSelectedScenario(prepared.id);
      } catch (err) {
        const message = (err as Error).message;
        setError(message);
        dispatch({ type: 'status', status: 'error' });
        dispatch({ type: 'appendLog', entry: createLog('error', message) });
      } finally {
        setLoadingScenario(false);
      }
    },
    []
  );

  useEffect(() => {
    let cancelled = false;
    async function bootstrap() {
      try {
        const response = await fetch('/scenarios/index.json');
        if (!response.ok) {
          throw new Error('Unable to load scenario manifest');
        }
        const manifestJson = (await response.json()) as ScenarioManifest;
        if (cancelled) {
          return;
        }
        setManifest(manifestJson.scenarios);
        if (manifestJson.scenarios.length) {
          await loadScenario(manifestJson.scenarios[0].id);
        }
      } catch (err) {
        if (!cancelled) {
          const message = (err as Error).message;
          setError(message);
          dispatch({ type: 'status', status: 'error' });
          dispatch({ type: 'appendLog', entry: createLog('error', message) });
        }
      }
    }
    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [loadScenario]);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const AnyWindow = window as typeof window & {
      webkitSpeechRecognition?: typeof window.SpeechRecognition;
    };
    const recognitionAvailable =
      Boolean(AnyWindow.SpeechRecognition) || Boolean(AnyWindow.webkitSpeechRecognition);
    if (!recognitionAvailable) {
      dispatch({ type: 'setMode', mode: 'manual' });
      dispatch({
        type: 'appendLog',
        entry: createLog('warning', 'Speech recognition unavailable — switched to manual mode')
      });
    }
  }, []);

  const currentStep = state.scenario ? state.scenario.steps[state.stepIndex] : null;

  const handleStart = useCallback(() => {
    if (!state.scenario) {
      return;
    }
    dispatch({ type: 'resetRun' });
    const sessionId = generateSessionId();
    sessionRef.current = sessionId;
    dispatch({ type: 'setSession', sessionId });
    dispatch({ type: 'status', status: 'running' });
    dispatch({ type: 'appendLog', entry: createLog('info', 'Session started') });
    setManualTranscript('');
    setCapturing(false);
  }, [state.scenario]);

  const handlePause = useCallback(() => {
    dispatch({ type: 'status', status: 'paused' });
    dispatch({ type: 'setSession', sessionId: null });
    setCapturing(false);
    stopAudio();
    dispatch({ type: 'appendLog', entry: createLog('info', 'Session paused') });
  }, []);

  const handleResume = useCallback(() => {
    if (!state.scenario) {
      return;
    }
    const sessionId = generateSessionId();
    sessionRef.current = sessionId;
    dispatch({ type: 'setSession', sessionId });
    dispatch({ type: 'status', status: 'running' });
    dispatch({ type: 'appendLog', entry: createLog('info', 'Session resumed') });
    setCapturing(false);
  }, [state.scenario]);

  const handleRestart = useCallback(() => {
    if (!state.scenario) {
      return;
    }
    dispatch({ type: 'resetRun' });
    const sessionId = generateSessionId();
    sessionRef.current = sessionId;
    dispatch({ type: 'setSession', sessionId });
    dispatch({ type: 'status', status: 'running' });
    dispatch({ type: 'appendLog', entry: createLog('info', 'Session restarted from beginning') });
    setManualTranscript('');
    setCapturing(false);
  }, [state.scenario]);

  const goToNextStep = useCallback(() => {
    if (!state.scenario) {
      return;
    }
    const nextIndex = state.stepIndex + 1;
    if (nextIndex >= state.scenario.steps.length) {
      dispatch({ type: 'status', status: 'complete' });
      dispatch({ type: 'setSession', sessionId: null });
      dispatch({ type: 'appendLog', entry: createLog('info', 'Scenario complete') });
    } else {
      dispatch({ type: 'setStep', stepIndex: nextIndex });
      dispatch({
        type: 'appendLog',
        entry: createLog('info', `Advanced to step ${nextIndex + 1}`)
      });
    }
    dispatch({ type: 'setInterim', transcript: '' });
    setManualTranscript('');
    setCapturing(false);
  }, [state.scenario, state.stepIndex]);

  const goToPreviousStep = useCallback(() => {
    if (!state.scenario) {
      return;
    }
    const prevIndex = Math.max(0, state.stepIndex - 1);
    dispatch({ type: 'setStep', stepIndex: prevIndex });
    dispatch({ type: 'setInterim', transcript: '' });
    setManualTranscript('');
    setCapturing(false);
    dispatch({ type: 'appendLog', entry: createLog('info', `Rewound to step ${prevIndex + 1}`) });
  }, [state.scenario, state.stepIndex]);

  const handleScore = useCallback(
    (stepIndex: number, transcript: string, mode: CaptureMode) => {
      const step = state.scenario?.steps[stepIndex];
      if (!step) {
        return;
      }
      const expected = step.expected ?? [];
      dispatch({ type: 'incrementRetry', stepIndex });
      const result = gradeUtterance(transcript, expected, gradeOptions, mode);
      dispatch({ type: 'setScore', stepIndex, score: result });
      dispatch({
        type: 'appendLog',
        entry: createLog(
          result.passed ? 'info' : result.autoPaused ? 'warning' : 'warning',
          `Step ${stepIndex + 1} scored ${result.score}% (${mode})`
        )
      });
      if (result.autoPaused) {
        dispatch({ type: 'status', status: 'paused' });
        dispatch({ type: 'setSession', sessionId: null });
        setCapturing(false);
      } else if (mode === 'speech' && state.mode === 'speech') {
        goToNextStep();
      }
    },
    [gradeOptions, goToNextStep, state.mode, state.scenario]
  );

  useEffect(() => {
    if (!state.scenario) {
      return;
    }
    if (state.status !== 'running') {
      return;
    }
    const step = state.scenario.steps[state.stepIndex];
    const sessionId = state.activeSessionId;
    if (!step || !sessionId) {
      return;
    }

    if (isCaptainStep(step)) {
      let cancelled = false;
      const runAudio = async () => {
        if (step.cue) {
          const success = await playCaptainCue(state.scenario!.id, step.cue);
          if (!cancelled) {
            dispatch({
              type: 'appendLog',
              entry: success
                ? createLog('info', `Played captain cue ${step.cue}`)
                : createLog('warning', `Cue ${step.cue} unavailable`)
            });
          }
        }
        if (!cancelled && sessionRef.current === sessionId) {
          goToNextStep();
        }
      };
      runAudio();
      return () => {
        cancelled = true;
      };
    }

    if (isIcemanStep(step) && state.mode === 'speech' && !capturing) {
      setCapturing(true);
      dispatch({ type: 'setInterim', transcript: 'Listening…' });
      listenOnce({
        maxDurationMs: MAX_DURATION,
        onInterim: (text) => {
          if (sessionRef.current === sessionId) {
            dispatch({ type: 'setInterim', transcript: text });
          }
        }
      }).then((result) => {
        if (sessionRef.current !== sessionId) {
          return;
        }
        setCapturing(false);
        dispatch({ type: 'setInterim', transcript: '' });
        if (result.ended === 'nosr') {
          dispatch({ type: 'setMode', mode: 'manual' });
          dispatch({
            type: 'appendLog',
            entry: createLog('warning', 'Speech capture unavailable — switched to manual mode')
          });
          dispatch({ type: 'status', status: 'paused' });
          dispatch({ type: 'setSession', sessionId: null });
          return;
        }
        if (!result.transcript) {
          dispatch({
            type: 'appendLog',
            entry: createLog('warning', 'No transcript captured — awaiting retry')
          });
          return;
        }
        handleScore(step.index, result.transcript, 'speech');
      });
    }
  }, [
    capturing,
    goToNextStep,
    handleScore,
    state.activeSessionId,
    state.mode,
    state.scenario,
    state.status,
    state.stepIndex
  ]);

  const handleManualSubmit = useCallback(() => {
    if (!currentStep || !isIcemanStep(currentStep)) {
      return;
    }
    const transcript = manualTranscript.trim();
    if (!transcript) {
      dispatch({
        type: 'appendLog',
        entry: createLog('warning', 'Provide a manual transcript before scoring')
      });
      return;
    }
    handleScore(currentStep.index, transcript, 'manual');
  }, [currentStep, handleScore, manualTranscript]);

  const handleExport = useCallback(() => {
    if (!state.scenario) {
      return;
    }
    const csv = createCsv(state.scenario, state.scores);
    const filename = `${state.scenario.id}-${new Date().toISOString().slice(0, 10)}.csv`;
    downloadCsv(filename, csv);
    dispatch({
      type: 'appendLog',
      entry: createLog('info', `Exported CSV to ${filename}`)
    });
  }, [state.scenario, state.scores]);

  const handlePrepareAudio = useCallback(() => {
    unlockAudioContext();
    dispatch({
      type: 'appendLog',
      entry: createLog('info', 'Audio context primed for playback and capture')
    });
  }, []);

  const summary = useMemo(() => {
    if (!state.scenario) {
      return { total: 0, graded: 0, passed: 0, average: null as number | null };
    }
    const gradedScores = Object.values(state.scores).filter(
      (score): score is UtteranceScore => Boolean(score)
    );
    const passed = gradedScores.filter((score) => score.passed).length;
    const average = gradedScores.length
      ? Math.round(
          gradedScores.reduce((acc, item) => acc + item.score, 0) / gradedScores.length
        )
      : null;
    return {
      total: state.scenario.steps.length,
      graded: gradedScores.length,
      passed,
      average
    };
  }, [state.scenario, state.scores]);

  const manualMode = state.mode === 'manual';

  return (
    <div className="trainer-shell">
      <PolarCard
        title="De-ice radio trainer"
        subtitle="Simulate captain hand-offs, capture responses, and audit phraseology."
        className="trainer-card"
      >
        <div className="trainer-card__body">
          <section className="trainer-card__header">
            <div className="trainer-select">
              <label className="trainer-select__label" htmlFor="scenario-select">
                Scenario catalog
              </label>
              <select
                id="scenario-select"
                className="trainer-select__control"
                value={selectedScenario ?? ''}
                onChange={(event) => loadScenario(event.target.value)}
                disabled={loadingScenario}
              >
                {manifest.map((item) => (
                  <option value={item.id} key={item.id}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="trainer-status">
              <span className={clsx('status-dot', state.status)} />
              <span className="trainer-status__label">{state.status.toUpperCase()}</span>
              <span className="trainer-status__mode">
                Mode: {manualMode ? 'Manual entry' : capturing ? 'Listening' : 'Speech capture'}
              </span>
            </div>
            <div className="trainer-actions">
              <button type="button" className="btn btn-outline" onClick={handlePrepareAudio}>
                Prepare mic & audio
              </button>
              {state.status !== 'running' ? (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={state.status === 'paused' || state.status === 'complete' ? handleResume : handleStart}
                  disabled={loadingScenario || !state.scenario}
                >
                  {state.status === 'paused' || state.status === 'complete' ? 'Resume' : 'Start'}
                </button>
              ) : (
                <button type="button" className="btn btn-outline" onClick={handlePause}>
                  Pause
                </button>
              )}
              <button
                type="button"
                className="btn btn-outline"
                onClick={handleRestart}
                disabled={!state.scenario}
              >
                Restart
              </button>
              <button type="button" className="btn btn-outline" onClick={handleExport} disabled={!state.scenario}>
                Export CSV
              </button>
            </div>
          </section>

          {error && <p className="status-message error">{error}</p>}

          {state.scenario && (
            <div className="trainer-layout">
              <div className="trainer-main">
                <div className="trainer-script">
                  <div className="trainer-script__header">
                    <span className="trainer-script__role">
                      {currentStep ? currentStep.role.toUpperCase() : '—'}
                    </span>
                    <span className="trainer-script__step">
                      Step {state.stepIndex + 1} of {state.scenario.steps.length}
                    </span>
                  </div>
                  <p className="trainer-script__prompt">{currentStep?.text ?? 'Select a scenario'}</p>
                  {currentStep?.tags && currentStep.tags.length > 0 && (
                    <div className="trainer-tags">
                      {currentStep.tags.map((tag) => (
                        <span key={tag} className="trainer-tag">
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="trainer-script__controls">
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={goToPreviousStep}
                      disabled={state.stepIndex === 0}
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={goToNextStep}
                      disabled={!state.scenario || state.stepIndex >= state.scenario.steps.length - 1}
                    >
                      Skip ahead
                    </button>
                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={() =>
                        dispatch({
                          type: 'setMode',
                          mode: manualMode ? 'speech' : 'manual'
                        })
                      }
                    >
                      {manualMode ? 'Return to speech capture' : 'Switch to manual mode'}
                    </button>
                  </div>
                </div>

                {currentStep && isIcemanStep(currentStep) && (
                  <div className="trainer-response">
                    {!manualMode && (
                      <div className="trainer-response__status">
                        <p>{state.interimTranscript ? `Interim: ${state.interimTranscript}` : capturing ? 'Listening for response…' : 'Awaiting start'}</p>
                        <p className="muted">The trainer auto-advances after a scored attempt.</p>
                      </div>
                    )}
                    {manualMode && (
                      <div className="trainer-manual">
                        <label htmlFor="manual-response">Manual response</label>
                        <textarea
                          id="manual-response"
                          value={manualTranscript}
                          onChange={(event) => setManualTranscript(event.target.value)}
                          placeholder="Type the iceman readback as delivered"
                        />
                        <div className="trainer-manual__actions">
                          <button type="button" className="btn btn-primary" onClick={handleManualSubmit}>
                            Score manual entry
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline"
                            onClick={goToNextStep}
                            disabled={state.stepIndex >= state.scenario.steps.length - 1}
                          >
                            Proceed without scoring
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {currentStep && isIcemanStep(currentStep) && state.scores[currentStep.index] && (
                  <div className="trainer-diff">
                    <div className="trainer-diff__header">
                      <h3>Score: {state.scores[currentStep.index]?.score}%</h3>
                      <span>{state.scores[currentStep.index]?.passed ? 'Passing' : 'Needs review'}</span>
                    </div>
                    <div className="trainer-diff__content">
                      <p className="muted">Expected: {state.scores[currentStep.index]?.expected}</p>
                      <p>Transcript: {state.scores[currentStep.index]?.transcript}</p>
                      <div className="trainer-diff__tokens">
                        {state.scores[currentStep.index]?.diff.map((chunk, index) => (
                          <span key={`${chunk.token}-${index}`} className={`token token--${chunk.type}`}>
                            {chunk.token}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <aside className="trainer-sidebar">
                <div className="trainer-summary">
                  <h3>Progress</h3>
                  <p>
                    {summary.graded} graded / {state.scenario.steps.length} steps
                  </p>
                  <p>Passes: {summary.passed}</p>
                  <p>Average score: {summary.average ?? '—'}</p>
                </div>
                <div className="trainer-log">
                  <h3>Session log</h3>
                  <ul>
                    {state.log.map((entry) => (
                      <li key={entry.at} className={`log-entry log-entry--${entry.level}`}>
                        <span className="log-entry__time">
                          {new Date(entry.at).toLocaleTimeString()}
                        </span>
                        <span>{entry.message}</span>
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="trainer-history">
                  <h3>Attempts</h3>
                  <ul>
                    {state.scenario.steps.map((step) => (
                      <li key={step.id} className="trainer-history__item">
                        <span>
                          {step.index + 1}. {step.role}
                        </span>
                        <span>
                          {state.scores[step.index]?.score ?? '—'}%
                          {state.retries[step.index] ? ` · retries ${state.retries[step.index]}` : ''}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </aside>
            </div>
          )}
        </div>
      </PolarCard>
    </div>
  );
}
