const DEFAULT_PATH = '/app';
const BASE_ALLOWED_PREFIXES = ['/app', '/auth', '/employee-app'] as const;

function normalizePrefix(prefix: string): string | null {
  const trimmed = prefix.trim();
  if (!trimmed || !trimmed.startsWith('/')) {
    return null;
  }

  if (trimmed.startsWith('//')) {
    return null;
  }

  if (trimmed === '/') {
    return trimmed;
  }

  return trimmed.replace(/\/+$/, '');
}

const envPrefixes =
  process.env.ALLOWED_REDIRECT_PREFIXES ?? process.env.NEXT_PUBLIC_ALLOWED_REDIRECT_PREFIXES ?? '';

const allowedPrefixes: string[] = Array.from(
  new Set(
    [
      ...BASE_ALLOWED_PREFIXES.map((prefix) => normalizePrefix(prefix)).filter(
        (prefix): prefix is string => Boolean(prefix)
      ),
      ...envPrefixes
        .split(',')
        .map((prefix) => normalizePrefix(prefix))
        .filter((prefix): prefix is string => Boolean(prefix))
    ]
  )
);

function hasAllowedPrefix(path: string): boolean {
  return allowedPrefixes.some((prefix) => {
    if (path === prefix) return true;
    return path.startsWith(`${prefix}/`) || path.startsWith(`${prefix}?`);
  });
}

export function sanitizeNextPath(raw?: string | null): string {
  if (!raw) return DEFAULT_PATH;

  const trimmed = raw.trim();
  if (!trimmed.startsWith('/')) {
    return DEFAULT_PATH;
  }

  if (trimmed.startsWith('//')) {
    return DEFAULT_PATH;
  }

  const [withoutHash] = trimmed.split('#', 1);
  const normalized = withoutHash || DEFAULT_PATH;

  if (!hasAllowedPrefix(normalized)) {
    return DEFAULT_PATH;
  }

  return normalized;
}

export function getDefaultNextPath(): string {
  return DEFAULT_PATH;
}