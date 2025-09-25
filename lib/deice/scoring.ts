import { DiffChunk, GradeOptions, UtteranceScore } from './types';

const DIGIT_WORDS: Record<string, string> = {
  '0': 'zero',
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine'
};

const NATO_MAP: Record<string, string> = {
  A: 'alpha',
  B: 'bravo',
  C: 'charlie',
  D: 'delta',
  E: 'echo',
  F: 'foxtrot',
  G: 'golf',
  H: 'hotel',
  I: 'india',
  J: 'juliet',
  K: 'kilo',
  L: 'lima',
  M: 'mike',
  N: 'november',
  O: 'oscar',
  P: 'papa',
  Q: 'quebec',
  R: 'romeo',
  S: 'sierra',
  T: 'tango',
  U: 'uniform',
  V: 'victor',
  W: 'whiskey',
  X: 'x-ray',
  Y: 'yankee',
  Z: 'zulu'
};

function normalizeDigits(text: string) {
  return text.replace(/\d/g, (digit) => ` ${DIGIT_WORDS[digit] ?? digit} `);
}

function expandNato(text: string) {
  return text.replace(/\b([A-Za-z])\b/g, (match) => NATO_MAP[match.toUpperCase()] ?? match);
}

function normalizeWhitespace(text: string) {
  return text
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeUtterance(value: string, options: { enableNato: boolean }) {
  let text = value.toLowerCase();
  text = normalizeDigits(text);
  if (options.enableNato) {
    text = expandNato(text);
  }
  return normalizeWhitespace(text);
}

function levenshtein(a: string, b: string) {
  if (a === b) {
    return 0;
  }

  if (a.length === 0) {
    return b.length;
  }
  if (b.length === 0) {
    return a.length;
  }

  const matrix = Array.from({ length: a.length + 1 }, (_, i) => Array(b.length + 1).fill(0));

  for (let i = 0; i <= a.length; i += 1) {
    matrix[i][0] = i;
  }
  for (let j = 0; j <= b.length; j += 1) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }

  return matrix[a.length][b.length];
}

function tokenDiff(expected: string[], actual: string[]): DiffChunk[] {
  const table = Array.from({ length: expected.length + 1 }, () =>
    Array(actual.length + 1).fill(0)
  );

  for (let i = 1; i <= expected.length; i += 1) {
    for (let j = 1; j <= actual.length; j += 1) {
      if (expected[i - 1] === actual[j - 1]) {
        table[i][j] = table[i - 1][j - 1] + 1;
      } else {
        table[i][j] = Math.max(table[i - 1][j], table[i][j - 1]);
      }
    }
  }

  const diff: DiffChunk[] = [];
  let i = expected.length;
  let j = actual.length;

  while (i > 0 && j > 0) {
    if (expected[i - 1] === actual[j - 1]) {
      diff.unshift({ token: expected[i - 1], type: 'match' });
      i -= 1;
      j -= 1;
    } else if (table[i - 1][j] >= table[i][j - 1]) {
      diff.unshift({ token: expected[i - 1], type: 'missing' });
      i -= 1;
    } else {
      diff.unshift({ token: actual[j - 1], type: 'extra' });
      j -= 1;
    }
  }

  while (i > 0) {
    diff.unshift({ token: expected[i - 1], type: 'missing' });
    i -= 1;
  }
  while (j > 0) {
    diff.unshift({ token: actual[j - 1], type: 'extra' });
    j -= 1;
  }

  return diff;
}

function computeScore(expected: string, actual: string, options: GradeOptions) {
  const normalizedExpected = normalizeUtterance(expected, {
    enableNato: options.enableNato
  });
  const normalizedActual = normalizeUtterance(actual, {
    enableNato: options.enableNato
  });

  if (!normalizedExpected && !normalizedActual) {
    return 100;
  }

  const distance = options.enableFuzzy
    ? levenshtein(normalizedExpected, normalizedActual)
    : normalizedExpected === normalizedActual
      ? 0
      : Math.max(normalizedExpected.length, normalizedActual.length);

  const maxLen = Math.max(normalizedExpected.length, normalizedActual.length, 1);
  const ratio = 1 - distance / maxLen;
  return Math.max(0, Math.min(100, Math.round(ratio * 100)));
}

function legacyScore(expected: string, actual: string) {
  const expectedTokens = normalizeWhitespace(expected.toLowerCase()).split(' ');
  const actualTokens = normalizeWhitespace(actual.toLowerCase()).split(' ');
  if (!expectedTokens[0] && !actualTokens[0]) {
    return 100;
  }
  let matches = 0;
  for (const token of expectedTokens) {
    if (actualTokens.includes(token)) {
      matches += 1;
    }
  }
  return Math.round((matches / expectedTokens.length) * 100);
}

export function gradeUtterance(
  transcript: string,
  expected: string[],
  options: GradeOptions,
  mode: 'speech' | 'manual'
): UtteranceScore {
  if (!expected.length) {
    return {
      score: 100,
      passed: true,
      autoPaused: false,
      mode,
      diff: [],
      transcript,
      expected: ''
    };
  }

  const useLegacy = process.env.NEXT_PUBLIC_USE_LEGACY_SCORING === 'true';

  let bestScore = -1;
  let bestExpected = expected[0];
  let bestDiff: DiffChunk[] = [];

  for (const candidate of expected) {
    const score = useLegacy
      ? legacyScore(candidate, transcript)
      : computeScore(candidate, transcript, options);

    if (score > bestScore) {
      bestScore = score;
      bestExpected = candidate;
      const expectedTokens = normalizeWhitespace(candidate.toLowerCase()).split(' ');
      const actualTokens = normalizeWhitespace(transcript.toLowerCase()).split(' ');
      bestDiff = tokenDiff(expectedTokens.filter(Boolean), actualTokens.filter(Boolean));
    }
  }

  const passed = bestScore >= options.passThreshold;
  const autoPaused = bestScore <= options.pauseThreshold;

  return {
    score: bestScore,
    passed,
    autoPaused,
    mode,
    diff: bestDiff,
    transcript,
    expected: bestExpected
  };
}
