import { ScenarioLogEntry } from './types';

export type AudioStatus =
  | { type: 'idle' }
  | { type: 'loading'; cue: string }
  | { type: 'playing'; cue: string }
  | { type: 'ended'; cue: string }
  | { type: 'error'; cue: string; error: Error };

type AudioListener = (event: AudioStatus) => void;

const listeners = new Set<AudioListener>();
const cueCache = new Map<string, boolean>();
let sharedAudio: HTMLAudioElement | null = null;
let currentUnlockPromise: Promise<void> | null = null;

function getSharedAudio() {
  if (typeof window === 'undefined') {
    return null;
  }

  if (!sharedAudio) {
    sharedAudio = document.createElement('audio');
    sharedAudio.preload = 'auto';
  }

  return sharedAudio;
}

function emit(event: AudioStatus) {
  listeners.forEach((listener) => {
    listener(event);
  });
}

export function subscribeToAudio(listener: AudioListener) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export async function unlockAudioContext() {
  if (typeof window === 'undefined') {
    return;
  }

  if (!currentUnlockPromise) {
    currentUnlockPromise = (async () => {
      const AnyContext =
        (window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }).AudioContext ??
        (window as typeof window & { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;

      if (!AnyContext) {
        return;
      }

      const context = new AnyContext();
      if (context.state === 'suspended') {
        await context.resume();
      }
      // Create a short silent buffer to fully unlock iOS playback
      const buffer = context.createBuffer(1, 1, 22050);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.start(0);
    })();
  }

  await currentUnlockPromise;
}

function cueKey(scenarioId: string, cue: string, ext: string) {
  return `${scenarioId}:${cue}:${ext}`;
}

async function tryLoad(url: string) {
  return new Promise<void>((resolve, reject) => {
    const audio = document.createElement('audio');
    audio.preload = 'auto';
    const cleanup = () => {
      audio.removeEventListener('canplaythrough', handleCanPlay);
      audio.removeEventListener('error', handleError);
    };

    const handleCanPlay = () => {
      cleanup();
      resolve();
    };

    const handleError = () => {
      cleanup();
      reject(new Error(`Failed to preload ${url}`));
    };

    audio.addEventListener('canplaythrough', handleCanPlay);
    audio.addEventListener('error', handleError);
    audio.src = url;
    audio.load();
  });
}

export async function preloadCaptainCues(
  scenarioId: string,
  cues: string[]
): Promise<ScenarioLogEntry[]> {
  if (typeof window === 'undefined') {
    return [];
  }

  const logs: ScenarioLogEntry[] = [];

  for (const cue of cues) {
    for (const ext of ['mp3', 'm4a']) {
      const key = cueKey(scenarioId, cue, ext);
      if (cueCache.get(key)) {
        continue;
      }

      const url = `/audio/${scenarioId}/captain_${cue}.${ext}`;
      try {
        await tryLoad(url);
        cueCache.set(key, true);
        logs.push({
          at: Date.now(),
          level: 'info',
          message: `Preloaded cue ${cue}.${ext}`
        });
      } catch (error) {
        logs.push({
          at: Date.now(),
          level: 'warning',
          message: `Unable to preload ${url}: ${(error as Error).message}`
        });
      }
    }
  }

  return logs;
}

export async function playCaptainCue(
  scenarioId: string,
  cue: string
): Promise<boolean> {
  const audio = getSharedAudio();
  if (!audio) {
    return false;
  }

  emit({ type: 'loading', cue });

  for (const ext of ['mp3', 'm4a']) {
    const url = `/audio/${scenarioId}/captain_${cue}.${ext}`;
    audio.src = url;

    try {
      await audio.play();
      emit({ type: 'playing', cue });

      await new Promise<void>((resolve) => {
        const handleEnded = () => {
          audio.removeEventListener('ended', handleEnded);
          resolve();
        };
        audio.addEventListener('ended', handleEnded, { once: true });
      });

      emit({ type: 'ended', cue });
      return true;
    } catch (error) {
      emit({ type: 'error', cue, error: error as Error });
    }
  }

  return false;
}

export function stopAudio() {
  const audio = getSharedAudio();
  if (!audio) {
    return;
  }

  audio.pause();
  audio.currentTime = 0;
  emit({ type: 'idle' });
}
