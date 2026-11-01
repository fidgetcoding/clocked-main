import { useEffect, useState } from 'react';

export type StageLayout = 'portrait' | 'landscape' | 'wide';

const LANDSCAPE = '(orientation: landscape) and (max-height: 520px)';
const WIDE = '(orientation: landscape) and (min-height: 521px) and (min-width: 900px)';

const read = (): StageLayout => {
  if (typeof window.matchMedia !== 'function') return 'portrait';
  if (window.matchMedia(WIDE).matches) return 'wide';
  if (window.matchMedia(LANDSCAPE).matches) return 'landscape';
  return 'portrait';
};

/** A phone held up, a phone propped sideways, or a laptop across the room. */
export function useStageLayout(): StageLayout {
  const [layout, setLayout] = useState<StageLayout>(read);

  useEffect(() => {
    const update = () => setLayout(read());
    const queries = [window.matchMedia(WIDE), window.matchMedia(LANDSCAPE)];
    queries.forEach((query) => query.addEventListener('change', update));
    window.addEventListener('resize', update);
    return () => {
      queries.forEach((query) => query.removeEventListener('change', update));
      window.removeEventListener('resize', update);
    };
  }, []);

  return layout;
}
