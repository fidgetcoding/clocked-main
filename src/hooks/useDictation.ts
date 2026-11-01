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
    recognizerRef.current?.stop();
    recognizerRef.current = null;
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
    recognizer.continuous = true;
    recognizer.interimResults = false;
    recognizer.lang = 'en-US';
    recognizer.onresult = (event) => {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        if (event.results[i].isFinal) onTextRef.current(event.results[i][0].transcript.trim());
      }
    };
    recognizer.onerror = (event) => {
      if (event.error === 'not-allowed') toast.error('Microphone access denied. Please enable it in your browser settings.');
      stop();
    };
    recognizer.onend = () => {
      if (recognizerRef.current === recognizer) stop();
    };
    recognizerRef.current = recognizer;
    recognizer.start();
    setListening(true);
  }, [stop]);

  return { supported: !!getSpeechRecognizerClass(), listening, toggle, stop };
}
