import { useEffect, useRef, type MutableRefObject } from 'react';

interface Options {
  index: number;
  active: boolean;
  voiceOn: boolean;
  comboOn: boolean;
  previousIndex: MutableRefObject<number>;
  announce: () => (() => void) | undefined;
}

/** Owns an announcement and its delayed combo across the lifetime of one active segment. */
export function useSegmentAnnouncement({ index, active, voiceOn, comboOn, previousIndex, announce }: Options) {
  const latest = useRef(announce);
  useEffect(() => { latest.current = announce; }, [announce]);
  useEffect(() => {
    if (!active || previousIndex.current === index) return;
    previousIndex.current = index;
    if (voiceOn) return latest.current();
  }, [index, active, voiceOn, comboOn, previousIndex]);
}
