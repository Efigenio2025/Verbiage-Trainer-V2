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

export type GradingToken = {
  word: string;
  display: string;
  digits: string;
  hasDigits: boolean;
  numberValue: string | null;
  numberSlots: string[];
  skeleton: string;
  phonetic: string;
  index?: number;
  [key: string]: unknown;
};

export type PreparedScenarioStep = ScenarioStep & {
  index: number;
  id: string;
  _displayLine: string;
  _expectedGradeText: string;
  _expectedForGrade: GradingToken[];
};

export type PreparedScenario = ScenarioFile & {
  steps: PreparedScenarioStep[];
  captainCues: string[];
  _expectedForGrade: GradingToken[][];
};

export type DiffToken = {
  index: number;
  word: string;
  display: string;
  status: 'match' | 'miss' | 'extra';
  kind: string;
  saidIndex?: number;
  expectedIndex?: number;
};

export type UtteranceScore = {
  score: number;
  passed: boolean;
  autoPaused: boolean;
  mode: 'speech' | 'manual';
  diff: DiffToken[];
  transcript: string;
  expected: string;
};

export type ScenarioLogEntry = {
  at: number;
  level: 'info' | 'warning' | 'error' | 'debug';
  message: string;
};

export type SessionStatus = 'initializing' | 'ready' | 'running' | 'paused' | 'complete' | 'error';

export type CaptureMode = 'speech' | 'manual';