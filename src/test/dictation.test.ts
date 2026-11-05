import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { useDictation } from '@/hooks/useDictation';
import type { SpeechRecognizer } from '@/lib/speechRecognition';

const made: FakeRecognizer[] = [];
class FakeRecognizer implements SpeechRecognizer {
  continuous = false; interimResults = false; lang = '';
  onstart = null; onend: (() => void) | null = null;
  onresult: SpeechRecognizer['onresult'] = null; onerror: SpeechRecognizer['onerror'] = null;
  static refuseNext = false;
  start = vi.fn(); stop = vi.fn(); abort = vi.fn();
  constructor() {
    made.push(this);
    if (FakeRecognizer.refuseNext) {
      FakeRecognizer.refuseNext = false;
      this.start.mockImplementation(() => { throw new Error('busy'); });
    }
  }
  say(text: string) {
    this.onresult?.({ resultIndex: 0, results: [Object.assign([{ transcript: ` ${text} ` }], { isFinal: true })] } as never);
  }
}

beforeEach(() => { made.length = 0; (window as unknown as { SpeechRecognition: unknown }).SpeechRecognition = FakeRecognizer; });
afterEach(() => { delete (window as unknown as { SpeechRecognition?: unknown }).SpeechRecognition; });

it('types what is said while listening', () => {
  const onText = vi.fn();
  const { result } = renderHook(() => useDictation(onText));
  act(() => result.current.toggle());
  made[0].say('jab cross');
  expect(onText).toHaveBeenCalledWith('jab cross');
});

it('drops a result that arrives after stopping, and discards pending ones', () => {
  const onText = vi.fn();
  const { result } = renderHook(() => useDictation(onText));
  act(() => result.current.toggle());
  act(() => result.current.stop());
  expect(made[0].abort).toHaveBeenCalled();
  made[0].say('late words');
  expect(onText).not.toHaveBeenCalled();
  expect(result.current.listening).toBe(false);
});

it("doesn't let an old session's error or end stop the new one", () => {
  const onText = vi.fn();
  const { result } = renderHook(() => useDictation(onText));
  act(() => result.current.toggle());
  act(() => result.current.toggle());
  act(() => result.current.toggle());
  const [old, fresh] = made;
  act(() => { old.onerror?.({ error: 'network' } as never); old.onend?.(); });
  expect(result.current.listening).toBe(true);
  expect(fresh.abort).not.toHaveBeenCalled();
  fresh.say('still here');
  expect(onText).toHaveBeenCalledWith('still here');
});

it('recovers when the browser refuses to start', () => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  FakeRecognizer.refuseNext = true;
  const { result } = renderHook(() => useDictation(vi.fn()));
  act(() => result.current.toggle());
  expect(result.current.listening).toBe(false);
  // Not stuck: the next tap starts a fresh session
  act(() => result.current.toggle());
  expect(made).toHaveLength(2);
  expect(result.current.listening).toBe(true);
});

it('stops listening when the page closes', () => {
  const { result, unmount } = renderHook(() => useDictation(vi.fn()));
  act(() => result.current.toggle());
  unmount();
  expect(made[0].abort).toHaveBeenCalled();
});
