import type { PublicExamQuestion } from '../../shared/types.ts';

export type VoiceCommandType =
  | { type: 'select_option'; index: number }
  | { type: 'next' }
  | { type: 'repeat' }
  | { type: 'explain' }
  | { type: 'skip' }
  | { type: 'submit' };

interface SpeechRecLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type SpeechRecConstructor = new () => SpeechRecLike;

function getSpeechRecConstructor(): SpeechRecConstructor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecConstructor;
    webkitSpeechRecognition?: SpeechRecConstructor;
  };
  return w.SpeechRecognition || w.webkitSpeechRecognition || null;
}

export function isSpeechSynthesisSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

export function isSpeechRecognitionSupported(): boolean {
  return Boolean(getSpeechRecConstructor());
}

export function stopSpeaking(): void {
  try {
    if (isSpeechSynthesisSupported()) {
      window.speechSynthesis.cancel();
    }
  } catch {
    // ignore speech cancel errors
  }
}

export function speakQuestion(
  q: PublicExamQuestion,
  onDone?: () => void
): boolean {
  if (!isSpeechSynthesisSupported()) return false;
  try {
    window.speechSynthesis.cancel();
    const parts: string[] = [];
    if (q.assertion && q.reason) {
      parts.push(`Assertion: ${q.assertion}. Reason: ${q.reason}.`);
    } else {
      parts.push(q.question);
    }

    if (q.options && q.options.length > 0) {
      const letters = ['A', 'B', 'C', 'D', 'E'];
      q.options.forEach((opt, idx) => {
        parts.push(`Option ${letters[idx] || idx + 1}: ${opt}.`);
      });
    } else if (q.matchPairs) {
      parts.push(`Match List 1 items: ${q.matchPairs.left.join(', ')}.`);
    }

    const utterance = new SpeechSynthesisUtterance(parts.join(' '));
    utterance.rate = 0.98;
    utterance.pitch = 1.0;
    utterance.onend = () => onDone?.();
    utterance.onerror = () => onDone?.();
    window.speechSynthesis.speak(utterance);
    return true;
  } catch {
    onDone?.();
    return false;
  }
}

export function parseVoiceTranscript(rawTranscript: string): VoiceCommandType | null {
  const t = rawTranscript.toLowerCase().trim();
  if (!t) return null;

  if (/\b(option\s*a|answer\s*a|choose\s*a|select\s*a)\b/.test(t) || t === 'a' || t === 'alpha') {
    return { type: 'select_option', index: 0 };
  }
  if (/\b(option\s*b|answer\s*b|choose\s*b|select\s*b)\b/.test(t) || t === 'b' || t === 'bravo') {
    return { type: 'select_option', index: 1 };
  }
  if (/\b(option\s*c|answer\s*c|choose\s*c|select\s*c)\b/.test(t) || t === 'c' || t === 'charlie') {
    return { type: 'select_option', index: 2 };
  }
  if (/\b(option\s*d|answer\s*d|choose\s*d|select\s*d)\b/.test(t) || t === 'd' || t === 'delta') {
    return { type: 'select_option', index: 3 };
  }
  if (/\b(next|continue|forward)\b/.test(t)) return { type: 'next' };
  if (/\b(repeat|read again|read question|speak)\b/.test(t)) return { type: 'repeat' };
  if (/\b(explain|why|check|answer)\b/.test(t)) return { type: 'explain' };
  if (/\b(skip|pass)\b/.test(t)) return { type: 'skip' };
  if (/\b(submit|finish|complete)\b/.test(t)) return { type: 'submit' };
  return null;
}

/**
 * Push-to-talk single-utterance voice recognizer.
 * Automatically stops after one phrase or 7 seconds so ambient room noise never triggers accidental submits.
 */
export function startPushToTalkListener(params: {
  onCommand: (cmd: VoiceCommandType, transcript: string) => void;
  onUnrecognized?: (transcript: string) => void;
  onStateChange: (listening: boolean) => void;
  onError?: (reason: string) => void;
}): () => void {
  const Ctor = getSpeechRecConstructor();
  if (!Ctor) {
    params.onError?.('Voice recognition is not supported in this browser.');
    params.onStateChange(false);
    return () => {};
  }

  let stopped = false;
  let rec: SpeechRecLike | null = null;
  let timer: number | null = null;

  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    if (timer) window.clearTimeout(timer);
    try {
      rec?.stop();
    } catch {
      // ignore
    }
    params.onStateChange(false);
  };

  try {
    rec = new Ctor();
    rec.lang = 'en-US';
    rec.continuous = false;
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (ev) => {
      const transcript = ev.results?.[0]?.[0]?.transcript || '';
      const cmd = parseVoiceTranscript(transcript);
      if (cmd) {
        params.onCommand(cmd, transcript);
      } else {
        params.onUnrecognized?.(transcript);
      }
      cleanup();
    };

    rec.onerror = (ev) => {
      params.onError?.(ev?.error || 'Could not capture voice command.');
      cleanup();
    };

    rec.onend = () => {
      cleanup();
    };

    params.onStateChange(true);
    rec.start();

    timer = window.setTimeout(() => {
      cleanup();
    }, 7000);
  } catch {
    params.onError?.('Unable to start microphone listener.');
    cleanup();
  }

  return cleanup;
}
