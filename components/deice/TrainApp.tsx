'use client';

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import Link from 'next/link';
import clsx from 'clsx';
import PolarCard from '@/components/PolarCard';
import { createCsv, downloadCsv } from '@/lib/deice/csv';
import {
  preloadCaptainCues,
  playCaptainCue,
  stopAudio,
  subscribeToAudio,
  unlockAudioContext,
  type AudioStatus
} from '@/lib/deice/audio';
import { prepareScenarioForGrading } from '@/lib/deice/scenario';
import { gradeUtterance } from '@/lib/deice/scoring';
import { listenOnce } from '@/lib/deice/speech';
import { getDefaultEmployee, getEmployeeById, listEmployees, type EmployeeProfile } from '@/lib/deice/employees';
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
const MAX_DURATION = 15_000;

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
      return { ...state, log: [...state.log, action.entry].slice(-200) };
    case 'batchAppendLogs':
      return { ...state, log: [...state.log, ...action.entries].slice(-200) };
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

      const blankScores: Record<number, UtteranceScore | null> = {};
      state.scenario.steps.forEach((step) => {
        blankScores[step.index] = null;
      });

      return {
        ...state,
        status: 'ready',
        stepIndex: 0,
        scores: blankScores,
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

function useViewportIsMobile(breakpoint = 900) {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    const mediaQuery = window.matchMedia(`(max-width: ${breakpoint}px)`);
    const update = () => setIsMobile(mediaQuery.matches);
    update();
    mediaQuery.addEventListener('change', update);
    return () => mediaQuery.removeEventListener('change', update);
  }, [breakpoint]);

  return isMobile;
}

export default function TrainApp() {
  const employees = listEmployees();
  const defaultEmployee = getDefaultEmployee() ?? employees[0];
  const [activeEmployeeId, setActiveEmployeeId] = useState<string>(
    defaultEmployee?.id ?? employees[0]?.id ?? ''
  );
  const activeEmployee: EmployeeProfile | undefined = useMemo(
    () => getEmployeeById(activeEmployeeId) ?? defaultEmployee ?? employees[0],
    [activeEmployeeId, defaultEmployee, employees]
  );

  const [state, dispatch] = useReducer(trainerReducer, initialTrainerState);
  const [manifest, setManifest] = useState<ScenarioManifestEntry[]>([]);
  const [selectedScenario, setSelectedScenario] = useState<string | null>(null);
  const [loadingScenario, setLoadingScenario] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualTranscript, setManualTranscript] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [audioStatus, setAudioStatus] = useState<AudioStatus>({ type: 'idle' });
  const [online, setOnline] = useState<boolean>(() =>
    typeof window === 'undefined' ? true : navigator.onLine
  );
  const [forceMobile, setForceMobile] = useState(false);
  const mobileOverrideRef = useRef(false);
  const lastScenarioAssignmentRef = useRef<string | null>(null);
  const sessionRef = useRef<string | null>(null);

  const viewportMobile = useViewportIsMobile();
  const isMobile = forceMobile || viewportMobile;

  useEffect(() => {
    const unsubscribe = subscribeToAudio((event) => {
      setAudioStatus(event);
    });
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }
    const updateOnline = () => setOnline(navigator.onLine);
    window.addEventListener('online', updateOnline);
    window.addEventListener('offline', updateOnline);
    return () => {
      window.removeEventListener('online', updateOnline);
      window.removeEventListener('offline', updateOnline);
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') {
      return;
    }

    type SpeechWindow = typeof window & {
      SpeechRecognition?: unknown;
      webkitSpeechRecognition?: unknown;
    };

    const speechWindow = window as SpeechWindow;
    const recognitionAvailable =
      Boolean(speechWindow.SpeechRecognition) || Boolean(speechWindow.webkitSpeechRecognition);

    if (!recognitionAvailable) {
      dispatch({ type: 'setMode', mode: 'manual' });
      dispatch({
        type: 'appendLog',
        entry: createLog('warning', 'Speech recognition unavailable — switched to manual mode')
      });
    }
  }, []);

  useEffect(() => {
    if (!activeEmployee) {
      return;
    }

    dispatch({
      type: 'appendLog',
      entry: createLog(
        'info',
        `Active trainee: ${activeEmployee.name} · ${activeEmployee.role} (${activeEmployee.base})`
      )
    });

    if (!mobileOverrideRef.current) {
      setForceMobile(activeEmployee.prefersMobile ?? false);
    }
    mobileOverrideRef.current = false;
  }, [activeEmployee]);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      try {
        const response = await fetch('/scenarios/index.json');
        if (!response.ok) {
          throw new Error('Unable to load scenario manifest');
        }
        const manifestJson = (await response.json()) as ScenarioManifest;
        if (!cancelled) {
          setManifest(manifestJson.scenarios);
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
  }, []);

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
      stopAudio();
      dispatch({ type: 'status', status: 'initializing' });
      try {
        const response = await fetch(`/scenarios/${scenarioId}.json`);
        if (!response.ok) {
          throw new Error(`Scenario ${scenarioId} returned ${response.status}`);
        }
        const data = (await response.json()) as ScenarioFile;
        const prepared = prepareScenarioForGrading(data);
        dispatch({ type: 'setScenario', scenario: prepared });
        dispatch({
          type: 'appendLog',
          entry: createLog('info', `Scenario “${prepared.label}” loaded`)
        });

        if (prepared.captainCues.length) {
          const logs = await preloadCaptainCues(prepared.id, prepared.captainCues);
          if (logs.length) {
            dispatch({ type: 'batchAppendLogs', entries: logs });
          }
        }

        dispatch({ type: 'status', status: 'ready' });
        setSelectedScenario(prepared.id);
        setManualTranscript('');
        setCapturing(false);
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
    if (!manifest.length) {
      return;
    }

    const fallbackScenario = manifest[0]?.id;
    const preferredScenario = activeEmployee?.defaultScenario;
    const availableIds = new Set(manifest.map((item) => item.id));
    const nextScenario =
      preferredScenario && availableIds.has(preferredScenario) ? preferredScenario : fallbackScenario;

    if (nextScenario && nextScenario !== selectedScenario) {
      loadScenario(nextScenario);
    }
  }, [manifest, activeEmployee?.defaultScenario, selectedScenario, loadScenario]);

  useEffect(() => {
    if (activeEmployee && state.scenario) {
      const assignmentKey = `${activeEmployee.id}:${state.scenario.id}`;
      if (lastScenarioAssignmentRef.current !== assignmentKey) {
        dispatch({
          type: 'appendLog',
          entry: createLog(
            'info',
            `${activeEmployee.name} assigned to scenario “${state.scenario.label}”`
          )
        });
        lastScenarioAssignmentRef.current = assignmentKey;
      }
    }
  }, [activeEmployee, state.scenario]);

  useEffect(() => {
    sessionRef.current = state.activeSessionId;
  }, [state.activeSessionId]);

  const handleStart = useCallback(() => {
    if (!state.scenario) {
      return;
    }
    dispatch({ type: 'resetRun' });
    const sessionId = generateSessionId();
    sessionRef.current = sessionId;
    dispatch({ type: 'setSession', sessionId });
    dispatch({ type: 'status', status: 'running' });
    dispatch({
      type: 'appendLog',
      entry: createLog('info', `${activeEmployee?.name ?? 'Trainee'} started a session`)
    });
    setManualTranscript('');
    setCapturing(false);
  }, [activeEmployee?.name, state.scenario]);

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
      dispatch({ type: 'appendLog', entry: createLog('info', `Advanced to step ${nextIndex + 1}`) });
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
    const currentStep = state.scenario?.steps[state.stepIndex];
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
  }, [handleScore, manualTranscript, state.scenario, state.stepIndex]);

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

  const currentStep = state.scenario ? state.scenario.steps[state.stepIndex] : null;
  const manualMode = state.mode === 'manual';

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

  const audioLabel = useMemo(() => {
    switch (audioStatus.type) {
      case 'loading':
        return `Loading ${audioStatus.cue}`;
      case 'playing':
        return `Playing ${audioStatus.cue}`;
      case 'ended':
        return `Finished ${audioStatus.cue}`;
      case 'error':
        return `Cue error`;
      default:
        return 'Audio idle';
    }
  }, [audioStatus]);

  const speechLabel = manualMode ? 'Manual mode' : capturing ? 'Listening' : 'Mic ready';
  const networkLabel = online ? 'Online' : 'Offline';

  const mobileLaunchLink = activeEmployee?.links?.mobile;

  return (
    <div className={clsx('trainer-shell', { 'trainer-shell--mobile': isMobile })}>
      <PolarCard
        title="De-ice radio trainer"
        subtitle="Simulate captain hand-offs, capture responses, and audit phraseology."
        className="trainer-card"
      >
        <div className="trainer-card__body">
          <header className="trainer-card__header">
            <div className="trainer-persona">
              <label className="trainer-persona__label" htmlFor="trainer-employee">
                Trainee profile
              </label>
              <select
                id="trainer-employee"
                className="trainer-persona__select"
                value={activeEmployee?.id ?? ''}
                onChange={(event) => setActiveEmployeeId(event.target.value)}
              >
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name} · {employee.role}
                  </option>
                ))}
              </select>
              {activeEmployee?.tags && activeEmployee.tags.length > 0 && (
                <div className="trainer-persona__tags">
                  {activeEmployee.tags.map((tag) => (
                    <span key={tag}>{tag}</span>
                  ))}
                </div>
              )}
            </div>

            <div className="trainer-indicators">
              <div className="trainer-indicator">
                <span className={clsx('status-dot', state.status)} />
                <span className="trainer-indicator__label">{state.status.toUpperCase()}</span>
              </div>
              <div className="trainer-indicator">
                <span
                  className={clsx('status-dot', manualMode ? 'paused' : capturing ? 'running' : 'ready')}
                />
                <span className="trainer-indicator__label">{speechLabel}</span>
              </div>
              <div className="trainer-indicator">
                <span
                  className={clsx(
                    'status-dot',
                    audioStatus.type === 'error'
                      ? 'error'
                      : audioStatus.type === 'playing'
                      ? 'running'
                      : audioStatus.type === 'loading'
                      ? 'paused'
                      : 'ready'
                  )}
                />
                <span className="trainer-indicator__label">{audioLabel}</span>
              </div>
              <div className="trainer-indicator">
                <span className={clsx('status-dot', online ? 'ready' : 'error')} />
                <span className="trainer-indicator__label">{networkLabel}</span>
              </div>
            </div>

            <div className="trainer-actions">
              <button type="button" className="btn btn-outline" onClick={handlePrepareAudio}>
                Prepare mic
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
              <button type="button" className="btn btn-outline" onClick={handleRestart} disabled={!state.scenario}>
                Restart
              </button>
              <button type="button" className="btn btn-outline" onClick={handleExport} disabled={!state.scenario}>
                Export CSV
              </button>
              <button
                type="button"
                className="btn btn-subtle trainer-mobile-toggle"
                onClick={() => {
                  mobileOverrideRef.current = true;
                  setForceMobile((value) => !value);
                }}
              >
                {isMobile ? 'Desktop layout' : 'Force mobile layout'}
              </button>
              {mobileLaunchLink && (
                <Link href={mobileLaunchLink} className="btn btn-subtle">
                  Open mobile trainer
                </Link>
              )}
            </div>
          </header>

          <section className="trainer-select">
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
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
            {state.scenario?.description && (
              <p className="trainer-select__description">{state.scenario.description}</p>
            )}
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
                      onClick={() => {
                        const nextMode = manualMode ? 'speech' : 'manual';
                        dispatch({ type: 'setMode', mode: nextMode });
                        dispatch({
                          type: 'appendLog',
                          entry: createLog('info', `Mode switched to ${nextMode}`)
                        });
                      }}
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
                  {activeEmployee?.qualifications && (
                    <div className="trainer-summary__qualifications">
                      <h4>Qualifications</h4>
                      <ul>
                        {activeEmployee.qualifications.map((item) => (
                          <li key={item}>{item}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
                <div className="trainer-log">
                  <h3>Session log</h3>
                  <ul>
                    {state.log.map((entry) => (
                      <li key={entry.at} className={`log-entry log-entry--${entry.level}`}>
                        <span className="log-entry__time">
                          {new Date(entry.at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
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

          {isMobile && (
            <div className="trainer-mobile-bar">
              <button
                type="button"
                className="btn btn-outline"
                onClick={state.status === 'running' ? handlePause : handleStart}
                disabled={loadingScenario || !state.scenario}
              >
                {state.status === 'running' ? 'Pause' : 'Start'}
              </button>
              <button
                type="button"
                className="btn btn-outline"
                onClick={() => {
                  const nextMode = manualMode ? 'speech' : 'manual';
                  dispatch({ type: 'setMode', mode: nextMode });
                  dispatch({ type: 'appendLog', entry: createLog('info', `Mode switched to ${nextMode}`) });
                }}
              >
                {manualMode ? 'Speech mode' : 'Manual mode'}
              </button>
              <button type="button" className="btn btn-outline" onClick={goToNextStep}>
                Next step
              </button>
            </div>
          )}
        </div>
      </PolarCard>
    </div>
  );
}
