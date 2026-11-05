import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { getSpeechRecognizerClass, type SpeechRecognizer } from '@/lib/speechRecognition';

/** Types what you say through the browser's speech recognition. Not every browser has one. */
export function useDictation(onText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recognizerRef = useRef<SpeechRecognizer | null>(null);
  const onTextRef = useRef(onText);
  onTextRef.current = onText;

  const stop = useCallback(() => {
    const recognizer = recognizerRef.current;
    recognizerRef.current = null;
    // abort, not stop: stop still delivers a pending result, which would land in a form already cleared or closed
    recognizer?.abort();
    setListening(false);
  }, []);

  useEffect(() => stop, [stop]);

  const toggle = useCallback(() => {
    if (recognizerRef.current) {
      stop();
      return;
    }
    const Recognizer = getSpeechRecognizerClass();
    if (!Recognizer) return;
    const recognizer = new Recognizer();
    // Every event checks it still belongs to the current session, so a late one from an older session does nothing
    const current = () => recognizerRef.current === recognizer;
    recognizer.continuous = true;
    recognizer.interimResults = false;
    recognizer.lang = 'en-US';
    recognizer.onresult = (event) => {
      if (!current()) return;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) onTextRef.current(event.results[i][0].transcript.trim());
      }
    };
    recognizer.onerror = (event) => {
      if (!current()) return;
      if (event.error === 'not-allowed') toast.error('Microphone access denied. Please enable it in your browser settings.');
      stop();
    };
    recognizer.onend = () => {
      if (current()) stop();
    };
    recognizerRef.current = recognizer;
    try {
      recognizer.start();
      setListening(true);
    } catch (error) {
      console.error('Dictation failed to start:', error);
      stop();
    }
  }, [stop]);

  return { supported: !!getSpeechRecognizerClass(), listening, toggle, stop };
}
