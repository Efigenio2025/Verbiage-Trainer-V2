const DEFAULT_PATH = '/app';
const ALLOWED_PREFIXES = ['/app', '/auth'];

function hasAllowedPrefix(path: string): boolean {
  return ALLOWED_PREFIXES.some((prefix) => {
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
