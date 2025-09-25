const normalize = (value: string) =>
  String(value || '')
    .toLowerCase()
    .replace(/[\u2019']/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const tokenize = (value: string) => normalize(value).split(' ').filter(Boolean);

const splitDisplayTokens = (value: string) =>
  String(value || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);

export type QuickScoreToken = {
  index: number;
  word: string;
  display: string;
  status: 'match' | 'miss' | 'extra';
  kind: 'exact' | 'missing' | 'extra';
};

export type QuickScoreMatch = {
  expectedIndex: number;
  expected: string;
  expectedDisplay: string;
  saidIndex: number;
  said: string;
  saidDisplay: string;
  kind: 'exact';
  score: number;
};

export type QuickScoreMiss = {
  expectedIndex: number;
  expected: string;
  expectedDisplay: string;
};

export type QuickScoreExtra = {
  saidIndex: number;
  said: string;
  saidDisplay: string;
};

export type QuickScoreDetail = {
  percent: number;
  totalExpected: number;
  totalMatched: number;
  matches: QuickScoreMatch[];
  misses: QuickScoreMiss[];
  extras: QuickScoreExtra[];
  expectedTokens: { word: string; display: string }[];
  saidTokens: { word: string; display: string }[];
  expectedAnnotated: QuickScoreToken[];
  saidAnnotated: QuickScoreToken[];
};

export function quickScore(expected: string, heard: string) {
  const expectedSet = new Set(tokenize(expected));
  const heardSet = new Set(tokenize(heard));
  const totalExpected = expectedSet.size;
  const totalMatched = Array.from(expectedSet).filter((token) => heardSet.has(token)).length;
  return totalExpected ? Math.round((totalMatched / totalExpected) * 100) : 0;
}

export function quickScoreDetail(expected: string, heard: string): QuickScoreDetail {
  const expectedTokens = tokenize(expected);
  const heardTokens = tokenize(heard);
  const expectedSet = new Set(expectedTokens);
  const heardSet = new Set(heardTokens);

  const totalExpected = expectedSet.size;
  const totalMatched = Array.from(expectedSet).filter((token) => heardSet.has(token)).length;
  const percent = totalExpected ? Math.round((totalMatched / totalExpected) * 100) : 0;

  const expectedDisplay = splitDisplayTokens(expected);
  const heardDisplay = splitDisplayTokens(heard);

  const expectedAnnotated: QuickScoreToken[] = expectedDisplay.map((display, idx) => {
    const token = normalize(display);
    const matched = heardSet.has(token);
    return {
      index: idx,
      word: token,
      display,
      status: matched ? 'match' : 'miss',
      kind: matched ? 'exact' : 'missing'
    };
  });

  const saidAnnotated: QuickScoreToken[] = heardDisplay.map((display, idx) => {
    const token = normalize(display);
    const matched = expectedSet.has(token);
    return {
      index: idx,
      word: token,
      display,
      status: matched ? 'match' : 'extra',
      kind: matched ? 'exact' : 'extra'
    };
  });

  const matches: QuickScoreMatch[] = expectedAnnotated
    .filter((entry) => entry.status === 'match')
    .map((entry) => {
      const saidIndex = heardTokens.indexOf(entry.word);
      return {
        expectedIndex: entry.index,
        expected: entry.word,
        expectedDisplay: entry.display,
        saidIndex,
        said: saidIndex >= 0 ? heardTokens[saidIndex] : entry.word,
        saidDisplay: saidIndex >= 0 ? heardDisplay[saidIndex] ?? entry.display : entry.display,
        kind: 'exact',
        score: 1
      };
    });

  const misses: QuickScoreMiss[] = expectedAnnotated
    .filter((entry) => entry.status !== 'match')
    .map((entry) => ({
      expectedIndex: entry.index,
      expected: entry.word,
      expectedDisplay: entry.display
    }));

  const extras: QuickScoreExtra[] = saidAnnotated
    .filter((entry) => entry.status === 'extra')
    .map((entry) => ({
      saidIndex: entry.index,
      said: entry.word,
      saidDisplay: entry.display
    }));

  return {
    percent,
    totalExpected,
    totalMatched,
    matches,
    misses,
    extras,
    expectedTokens: expectedAnnotated.map((entry) => ({ word: entry.word, display: entry.display })),
    saidTokens: saidAnnotated.map((entry) => ({ word: entry.word, display: entry.display })),
    expectedAnnotated,
    saidAnnotated
  };
}

export default quickScore;
