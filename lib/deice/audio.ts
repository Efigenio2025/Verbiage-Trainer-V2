export type AudioStatusEvent =
  | { who: 'captain'; status: 'loading' | 'playing' | 'ended' | 'error'; src?: string }
  | { who: 'captain'; status: 'unlocked' | 'idle' };

const SUPPORTED_EXTS = ['mp3', 'm4a'];
const ROOT = '/audio';

let sharedAudio: HTMLAudioElement | null = null;

function getAudioEl() {
  if (typeof window === 'undefined') return null;
  if (!sharedAudio) {
    sharedAudio = new Audio();
    sharedAudio.preload = 'auto';
    sharedAudio.crossOrigin = 'anonymous';
    sharedAudio.setAttribute('playsinline', 'true');
  }
  return sharedAudio;
}

const bus: EventTarget | null = typeof window !== 'undefined' ? new EventTarget() : null;

export function onAudio(handler: (event: AudioStatusEvent) => void) {
  if (!bus) return () => {};
  const wrapped = (evt: Event) => {
    const detail = (evt as CustomEvent<AudioStatusEvent>).detail;
    handler(detail);
  };
  bus.addEventListener('status', wrapped as EventListener);
  return () => bus.removeEventListener('status', wrapped as EventListener);
}

function emit(event: AudioStatusEvent) {
  if (!bus) return;
  bus.dispatchEvent(new CustomEvent('status', { detail: event }));
}

export async function unlockAudio() {
  const el = getAudioEl();
  if (!el) return;

  try {
    const Ctx =
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).AudioContext ||
      (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (Ctx) {
      const ctx = (window as typeof window & { __ac?: AudioContext }).__ac || new Ctx();
      (window as typeof window & { __ac?: AudioContext }).__ac = ctx;
      if (ctx.state === 'suspended') {
        await ctx.resume();
      }
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      gain.gain.value = 0;
      osc.connect(gain).connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.01);
    }
  } catch (err) {
    // ignore
  }

  try {
    el.muted = true;
    await el.play().catch(() => {});
    el.pause();
    el.currentTime = 0;
    el.muted = false;
  } catch (err) {
    // ignore
  }

  emit({ who: 'captain', status: 'unlocked' });
}

function captainSrc(scnId: string, cue: string, ext: string) {
  return `${ROOT}/${scnId}/captain_${cue}.${ext}`;
}

async function playFromCandidates(label: 'captain', candidates: string[]) {
  const el = getAudioEl();
  if (!el) return false;

  el.onended = el.onerror = el.oncanplay = el.onloadedmetadata = null;
  emit({ who: label, status: 'loading' });

  let lastErr: unknown = null;

  for (const src of candidates) {
    try {
      el.pause();
      el.currentTime = 0;
    } catch (err) {
      // ignore
    }

    el.src = src;
    try {
      el.load();
    } catch (err) {
      // ignore
    }

    el.muted = false;
    el.volume = 1;

    const ok = await new Promise<boolean>((resolve) => {
      let guard: ReturnType<typeof setTimeout> | null = null;

      el.onloadedmetadata = () => {
        const ms = isFinite(el.duration) && el.duration > 0 ? Math.min(15000, el.duration * 1000 + 1000) : 12000;
        guard = setTimeout(() => resolve(true), ms);
      };

      el.oncanplay = async () => {
        try {
          await el.play();
          emit({ who: label, status: 'playing', src });
        } catch (err) {
          lastErr = err;
          resolve(false);
        }
      };

      el.onended = () => {
        if (guard) clearTimeout(guard);
        emit({ who: label, status: 'ended' });
        resolve(true);
      };

      el.onerror = () => {
        resolve(false);
      };
    });

    if (ok) return true;
  }

  console.error(`[audio] failed for ${label}`, { lastErr, candidates });
  emit({ who: label, status: 'error' });
  return false;
}

export async function playCaptainCue(scnId: string, cue: string) {
  const candidates = SUPPORTED_EXTS.map((ext) => captainSrc(scnId, cue, ext));
  return playFromCandidates('captain', candidates);
}

export function preloadCaptainCues(scnId: string, cues: string[] = []) {
  if (typeof document === 'undefined') return;
  cues.forEach((cue) => {
    SUPPORTED_EXTS.forEach((ext) => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'audio';
      link.href = captainSrc(scnId, cue, ext);
      document.head.appendChild(link);
    });
  });
}

export function stopAudio() {
  const el = getAudioEl();
  try {
    el?.pause();
  } catch (err) {
    // ignore
  }
  if (el) {
    el.currentTime = 0;
    emit({ who: 'captain', status: 'idle' });
  }
}