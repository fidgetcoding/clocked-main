// The browser speech API isn't in TypeScript's DOM types, so this covers the parts the app uses

export interface SpeechResultEvent {
  resultIndex: number;
  results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }>;
}

export interface SpeechErrorEvent {
  error: string;
}

export interface SpeechRecognizer {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onstart: (() => void) | null;
  onend: (() => void) | null;
  onresult: ((event: SpeechResultEvent) => void) | null;
  onerror: ((event: SpeechErrorEvent) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type SpeechRecognizerClass = new () => SpeechRecognizer;

export function getSpeechRecognizerClass(): SpeechRecognizerClass | undefined {
  const speechWindow = window as Window & {
    SpeechRecognition?: SpeechRecognizerClass;
    webkitSpeechRecognition?: SpeechRecognizerClass;
  };
  return speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition;
}
