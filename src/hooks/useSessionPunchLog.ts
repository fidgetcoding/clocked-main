import { useCallback, useMemo, useRef, useState } from 'react';
import { parsePunchLog, PunchLogRecorder, type PunchLog } from '@/lib/punch/sessionLog';
import type { PunchEvent } from '@/lib/punch/types';

/** Holds a session's punch log above the camera panel, so that it outlives the camera going off and on. */
export function useSessionPunchLog(elapsedSeconds: number) {
  const recorderRef = useRef(new PunchLogRecorder());
  const elapsedRef = useRef(elapsedSeconds);
  elapsedRef.current = elapsedSeconds;
  const [version, setVersion] = useState(0);
  const changed = useCallback(() => setVersion((value) => value + 1), []);

  const onTracking = useCallback(() => {
    recorderRef.current.markTracking();
    changed();
  }, [changed]);

  const onEvent = useCallback(
    (event: PunchEvent) => {
      recorderRef.current.record(event);
      changed();
    },
    [changed],
  );

  const startRound = useCallback(() => {
    recorderRef.current.startRound(elapsedRef.current, performance.now());
    changed();
  }, [changed]);

  const endRound = useCallback(() => {
    recorderRef.current.endRound(elapsedRef.current);
    changed();
  }, [changed]);

  const restore = useCallback(
    (saved: unknown) => {
      recorderRef.current = new PunchLogRecorder(parsePunchLog(saved));
      changed();
    },
    [changed],
  );

  const snapshot = useCallback((): PunchLog => recorderRef.current.snapshot(elapsedRef.current), []);
  const finish = useCallback((): PunchLog | null => recorderRef.current.finish(elapsedRef.current), []);

  // eslint-disable-next-line react-hooks/exhaustive-deps -- the recorder changes in place, and version tracks it
  const log = useMemo(() => recorderRef.current.snapshot(elapsedSeconds), [version, elapsedSeconds]);

  return { log, lastCue: recorderRef.current.lastCue, onTracking, onEvent, startRound, endRound, restore, snapshot, finish };
}
