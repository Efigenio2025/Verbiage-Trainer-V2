import { ListenOptions, ListenResult } from './types';

const BENIGN_ERRORS = new Set(['no-speech', 'aborted', 'network']);

type SpeechRecognitionConstructor = new () => any;

function getSpeechRecognition(): SpeechRecognitionConstructor | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const AnyWindow = window as typeof window & {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };

  const Recognition = AnyWindow.SpeechRecognition ?? AnyWindow.webkitSpeechRecognition;
  return Recognition ?? null;
}

export function listenOnce(options: ListenOptions = {}, attempt = 0): Promise<ListenResult> {
  if (typeof window === 'undefined') {
    return Promise.resolve({ ended: 'nosr', transcript: '', confidence: 0 });
  }

  const Recognition = getSpeechRecognition();
  if (!Recognition) {
    return Promise.resolve({ ended: 'nosr', transcript: '', confidence: 0 });
  }

  return new Promise<ListenResult>((resolve) => {
    const recognition = new Recognition();
    recognition.lang = options.locale ?? 'en-US';
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    let finalTranscript = '';
    let confidence = 0;
    let resolved = false;
    let durationTimer: ReturnType<typeof setTimeout> | null = null;

    const cleanup = () => {
      if (durationTimer) {
        clearTimeout(durationTimer);
        durationTimer = null;
      }
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.onspeechend = null;
    };

    const finish = (result: ListenResult) => {
      if (resolved) {
        return;
      }
      resolved = true;
      cleanup();
      resolve(result);
    };

    recognition.onresult = (event: any) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        if (result.isFinal) {
          finalTranscript += `${result[0].transcript} `;
          confidence = Math.max(confidence, result[0].confidence ?? 0);
        } else {
          interim += result[0].transcript;
        }
      }
      if (options.onInterim) {
        options.onInterim(interim.trim());
      }
    };

    recognition.onerror = (event: { error: string }) => {
      if (resolved) {
        return;
      }

      if (BENIGN_ERRORS.has(event.error) && attempt < 2) {
        cleanup();
        recognition.stop();
        setTimeout(() => {
          listenOnce(options, attempt + 1).then(resolve);
        }, 250);
        return;
      }

      finish({
        ended: 'aborted',
        transcript: finalTranscript.trim(),
        confidence
      });
    };

    recognition.onend = () => {
      if (resolved) {
        return;
      }
      const trimmed = finalTranscript.trim();
      if (trimmed) {
        finish({ ended: 'success', transcript: trimmed, confidence });
      } else {
        finish({ ended: 'silence', transcript: '', confidence: 0 });
      }
    };

    recognition.onspeechend = () => {
      recognition.stop();
    };

    if (options.maxDurationMs) {
      durationTimer = setTimeout(() => {
        recognition.stop();
        finish({
          ended: 'maxDuration',
          transcript: finalTranscript.trim(),
          confidence
        });
      }, options.maxDurationMs);
    }

    try {
      recognition.start();
    } catch (error) {
      finish({ ended: 'aborted', transcript: '', confidence: 0 });
    }
  });
}
