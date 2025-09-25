export type ScenarioRole = 'captain' | 'iceman';

export type ScenarioManifestEntry = {
  id: string;
  label: string;
};

export type ScenarioManifest = {
  scenarios: ScenarioManifestEntry[];
};

export type ScenarioStep = {
  role: ScenarioRole;
  text: string;
  cue?: string;
  expected?: string[];
  tags?: string[];
};

export type ScenarioFile = {
  id: string;
  label: string;
  description?: string;
  metadata?: Record<string, string>;
  steps: ScenarioStep[];
};

export type PreparedScenarioStep = ScenarioStep & {
  index: number;
  id: string;
};

export type PreparedScenario = {
  id: string;
  label: string;
  description?: string;
  metadata?: Record<string, string>;
  steps: PreparedScenarioStep[];
  captainCues: string[];
};

export type UtteranceScore = {
  score: number;
  passed: boolean;
  autoPaused: boolean;
  mode: 'speech' | 'manual';
  diff: DiffChunk[];
  transcript: string;
  expected: string;
};

export type DiffChunk = {
  token: string;
  type: 'match' | 'missing' | 'extra' | 'mismatch';
};

export type ScenarioLogEntry = {
  at: number;
  level: 'info' | 'warning' | 'error';
  message: string;
};

export type SessionStatus =
  | 'initializing'
  | 'ready'
  | 'running'
  | 'paused'
  | 'complete'
  | 'error';

export type CaptureMode = 'speech' | 'manual';

export type TrainerState = {
  status: SessionStatus;
  mode: CaptureMode;
  scenario: PreparedScenario | null;
  stepIndex: number;
  log: ScenarioLogEntry[];
  retries: Record<number, number>;
  scores: Record<number, UtteranceScore | null>;
  interimTranscript: string;
  activeSessionId: string | null;
};

export type GradeOptions = {
  passThreshold: number;
  pauseThreshold: number;
  enableFuzzy: boolean;
  enableNato: boolean;
};

export type ListenOptions = {
  locale?: string;
  maxDurationMs?: number;
  onInterim?: (transcript: string) => void;
};

export type ListenResult =
  | {
      ended: 'success';
      transcript: string;
      confidence: number;
    }
  | {
      ended: 'silence' | 'maxDuration' | 'aborted';
      transcript: string;
      confidence: number;
    }
  | {
      ended: 'nosr';
      transcript: '';
      confidence: 0;
    };
