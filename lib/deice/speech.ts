export type ListenOnceOptions = {
  minMs?: number;
  maxMs?: number;
  silenceMs?: number;
  onInterim?: (value: string) => void;
  onStatus?: (value: string) => void;
};

export type ListenOnceResult = {
  final: string;
  interim: string;
  ended: string;
};

export async function ensureMicPermission(setStatus: (status: string) => void = () => {}) {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
    setStatus('Microphone permission unavailable.');
    throw new Error('Media devices not available');
  }

  try {
    setStatus('Requesting microphone permission…');
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false }
    });
    stream.getTracks().forEach((track) => track.stop());
    setStatus('Microphone ready.');
    return true;
  } catch (error) {
    setStatus('Microphone permission was not granted.');
    throw error;
  }
}

export function listenOnce({
  minMs = 200,
  maxMs = 20000,
  silenceMs = 3500,
  onInterim = () => {},
  onStatus = () => {}
}: ListenOnceOptions = {}): Promise<ListenOnceResult> {
  return new Promise((resolve) => {
    const AnyRecognition =
      (typeof window !== 'undefined' &&
        ((window as typeof window & { webkitSpeechRecognition?: any; SpeechRecognition?: any }).SpeechRecognition ||
          (window as typeof window & { webkitSpeechRecognition?: any; SpeechRecognition?: any }).webkitSpeechRecognition)) ||
      null;

    if (!AnyRecognition) {
      resolve({ final: '', interim: '', ended: 'nosr' });
      return;
    }

    let finalText = '';
    let interimText = '';
    let started = Date.now();
    let lastActivity = started;
    let stopped = false;
    let recognizer: any = null;

    const shouldStop = () => {
      const now = Date.now();
      const elapsed = now - started;
      const idle = now - lastActivity;
      if (elapsed < minMs) return false;
      if (idle >= silenceMs) return true;
      if (elapsed >= maxMs) return true;
      return false;
    };

    const endAll = (reason = 'end') => {
      if (stopped) return;
      stopped = true;
      try {
        recognizer?.abort?.();
      } catch (err) {
        // ignore
      }
      resolve({ final: finalText.trim(), interim: interimText.trim(), ended: reason });
    };

    const restart = () => {
      setTimeout(() => {
        if (!stopped) startRecognizer();
      }, 140);
    };

    const startRecognizer = () => {
      if (stopped || !AnyRecognition) return;
      recognizer = new AnyRecognition();
      recognizer.lang = 'en-US';
      recognizer.continuous = false;
      recognizer.interimResults = true;
      recognizer.maxAlternatives = 1;

      recognizer.onstart = () => {
        lastActivity = Date.now();
        onStatus('Listening…');
      };
      recognizer.onsoundstart = () => {
        lastActivity = Date.now();
      };
      recognizer.onspeechstart = () => {
        lastActivity = Date.now();
      };
      recognizer.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i += 1) {
          const transcript = event.results[i][0]?.transcript || '';
          if (transcript) {
            lastActivity = Date.now();
          }
          if (event.results[i].isFinal) {
            finalText += (finalText ? ' ' : '') + transcript;
          } else {
            interim += (interim ? ' ' : '') + transcript;
          }
        }
        interimText = interim;
        const combined = (finalText + (interimText ? ` ${interimText}` : '')).trim();
        onInterim(combined);
      };

      recognizer.onerror = () => {
        if (shouldStop()) {
          endAll('error');
        } else {
          restart();
        }
      };

      recognizer.onend = () => {
        if (shouldStop()) {
          endAll('ended');
        } else {
          restart();
        }
      };

      try {
        recognizer.start();
        onStatus('Listening…');
      } catch (error) {
        if (shouldStop()) {
          endAll('start-failed');
        } else {
          restart();
        }
      }
    };

    const guard = setInterval(() => {
      if (stopped) {
        clearInterval(guard);
        return;
      }
      if (shouldStop()) {
        clearInterval(guard);
        endAll('ok');
      }
    }, 120);

    onInterim('');
    onStatus('Preparing mic…');
    startRecognizer();
  });
}