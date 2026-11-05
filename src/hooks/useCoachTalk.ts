import { useEffect, useRef } from 'react';
import { coachVoice } from '@/lib/voice/coachVoice';
import { appendPunchSample, comboTarget, isWorkRound, NAILED_GAP_S, paceDropped, pickLine, talkAt, type PunchSample, type TalkSegment } from '@/lib/voice/coachTalk';
import { COACH_GROUPS, coachLine, type CoachLine } from '@/lib/voice/lines';

/** How long a combo has to sit unchanged on the camera's readout before it counts as finished. */
const COMBO_SETTLE_MS = 1300;

interface Options {
  segments: (TalkSegment & { combo?: string[] })[];
  index: number;
  timeRemaining: number;
  /** The clock is running on a real segment: started, not paused, past Get Ready, not finished. */
  live: boolean;
  isComplete: boolean;
  /** The camera's running punch count, or null with the camera off. */
  punches: number | null;
  /** The combo the camera just read, "1-2-3", or null with the camera off. */
  seenCombo: string | null;
}

/** Recorded coach talk only: with no clip for a line, it says nothing at all. */
const say = (key: CoachLine) => coachVoice.say(coachLine(key), { queued: true, recordedOnly: true });

/**
 * The coach's own talk through a workout: halfway, a word of encouragement now and then, a nudge when
 * the punching drops off, praise for a clean combo, the rest-period words and the finish.
 */
export function useCoachTalk({ segments, index, timeRemaining, live, isComplete, punches, seenCombo }: Options) {
  const now = useRef(0);
  const lastTalk = useRef(-Infinity);
  const lastPace = useRef(-Infinity);
  const lastNailed = useRef(-Infinity);
  const lastLine = useRef<CoachLine | null>(null);
  const samples = useRef<PunchSample[]>([]);
  const segment = segments[index];

  // Each round's pace is its own
  useEffect(() => {
    samples.current = [];
  }, [index]);

  useEffect(() => {
    if (!live || !segment) return;
    now.current += 1;
    if (punches !== null && isWorkRound(segment)) appendPunchSample(samples.current, { at: now.current, punches });
    const talk = talkAt({
      segment,
      next: segments[index + 1],
      timeRemaining,
      now: now.current,
      lastTalk: lastTalk.current,
      lastPace: lastPace.current,
      slowing: punches !== null && paceDropped(samples.current, now.current),
      random: Math.random,
    });
    if (!talk) return;
    const line = pickLine(talk.lines, Math.random, lastLine.current);
    if (!say(line)) return;
    lastLine.current = line;
    lastTalk.current = now.current;
    if (talk.pace) lastPace.current = now.current;
    // Only fires on the clock ticking
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeRemaining]);

  // A combo thrown as called, read right by the camera
  const target = live && isWorkRound(segment) ? comboTarget(segment?.combo) : null;
  useEffect(() => {
    if (!target || seenCombo !== target) return;
    const timer = setTimeout(() => {
      if (now.current - lastNailed.current < NAILED_GAP_S) return;
      const line = pickLine(COACH_GROUPS.nailed, Math.random, lastLine.current);
      if (!say(line)) return;
      lastLine.current = line;
      lastNailed.current = now.current;
      lastTalk.current = now.current;
    }, COMBO_SETTLE_MS);
    return () => clearTimeout(timer);
  }, [target, seenCombo]);

  useEffect(() => {
    if (isComplete) say('workoutDone');
  }, [isComplete]);
}
