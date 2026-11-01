import { useRef } from 'react';

// For an effect that should read the current value of something without re-running when it changes
export function useLatest<T>(value: T) {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
