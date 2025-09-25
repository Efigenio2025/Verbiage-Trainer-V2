import { PreparedScenario, UtteranceScore } from './types';

type ScoreRecord = {
  stepIndex: number;
  prompt: string;
  role: string;
  score: number | null;
  passed: boolean | null;
  transcript: string;
  expected: string;
  mode: 'speech' | 'manual' | null;
};

function escapeCsv(value: string) {
  const needsQuote = /[",\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

export function createCsv(
  scenario: PreparedScenario,
  scores: Record<number, UtteranceScore | null>
): string {
  const rows: ScoreRecord[] = scenario.steps.map((step: PreparedScenario['steps'][number]) => ({
    stepIndex: step.index + 1,
    prompt: step.text,
    role: step.role,
    score: scores[step.index]?.score ?? null,
    passed: scores[step.index]?.passed ?? null,
    transcript: scores[step.index]?.transcript ?? '',
    expected: scores[step.index]?.expected ?? '',
    mode: scores[step.index]?.mode ?? null
  }));

  const header = [
    'Scenario',
    'Step',
    'Role',
    'Prompt',
    'Score',
    'Passed',
    'Mode',
    'Transcript',
    'Expected'
  ];

  const dataRows = rows.map((row) =>
    [
      scenario.label,
      String(row.stepIndex),
      row.role,
      row.prompt,
      row.score === null ? '' : String(row.score),
      row.passed === null ? '' : row.passed ? 'yes' : 'no',
      row.mode ?? '',
      row.transcript,
      row.expected
    ].map((cell) => escapeCsv(cell ?? '')).join(',')
  );

  return [header.map(escapeCsv).join(','), ...dataRows].join('\n');
}

export function downloadCsv(filename: string, content: string) {
  if (typeof window === 'undefined') {
    return;
  }

  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}