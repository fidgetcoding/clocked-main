import { describeCamera, placementAdvice, StartCheck } from '@/lib/punch/startCheck';
import { replayRecording, unpackLandmarks, type PunchRecording, type ReplayResult } from '@/lib/punch/recording';
import type { CameraRead, SpotScore } from './angleSpots';

/** The same numbers `npm run punch:confusion` prints, boiled down to one spot's row. */
export function scoreReplay(result: ReplayResult): SpotScore {
  let expected = 0;
  let counted = 0;
  let right = 0;
  let unnamed = 0;
  let wrongHand = 0;
  let falsePunches = result.outsideSteps;
  for (const row of result.rows) {
    if (row.label === 'guard') {
      falsePunches += row.total;
      continue;
    }
    expected += row.expected;
    counted += row.total;
    right += row.counts[row.label];
    unnamed += row.counts.punch;
    wrongHand += row.wrongHand;
  }
  return {
    expected,
    counted,
    right,
    wrong: counted - right - unnamed,
    unnamed,
    falsePunches,
    wrongHand,
    seenShare: result.framesTotal === 0 ? 0 : result.framesWithPerson / result.framesTotal,
  };
}

/**
 * What the start check would have said about the camera, read from the recording's first step,
 * where you stand still in your guard. The recorder skips the live check, so this stands in for it.
 */
export function readCamera(recording: PunchRecording): CameraRead {
  const first = recording.segments[0];
  const check = new StartCheck();
  for (const frame of recording.frames) {
    if (first && (frame.t < first.startT || frame.t > first.endT)) continue;
    check.push(frame.t, unpackLandmarks(frame.world), unpackLandmarks(frame.image));
  }
  const result = check.result();
  return {
    says: describeCamera(result),
    side: result.cameraSide,
    angle: result.cameraAngle,
    height: result.cameraHeight,
    seenShare: result.seenShare,
    handsHidden: result.handsHidden,
    gaveUp: result.gaveUp,
    advice: placementAdvice(result),
  };
}

export function scoreRecording(recording: PunchRecording): { score: SpotScore; camera: CameraRead } {
  return { score: scoreReplay(replayRecording(recording)), camera: readCamera(recording) };
}
