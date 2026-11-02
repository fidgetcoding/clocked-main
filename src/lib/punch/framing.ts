import { LM } from './body';
import { PUNCH_CONFIG, type PunchConfig } from './config';
import type { Landmark } from './types';

export type FramingStatus =
  | 'ok'
  | 'no_person'
  | 'too_dark'
  | 'low_confidence'
  | 'out_of_frame'
  | 'too_close'
  | 'too_far'
  | 'head_cut';

export const FRAMING_MESSAGES: Record<Exclude<FramingStatus, 'ok'>, string> = {
  no_person: "Can't see anyone. Step into the picture, and move the phone if the bag is in the way.",
  too_dark: 'Too dark to track you. Turn on a light in front of you.',
  low_confidence: "Can't see your arms clearly. Add light, or move the phone if the bag is in the way.",
  out_of_frame: 'Get your head, shoulders and hips in the picture.',
  too_close: 'Too close. Step back to about 6 to 10 feet.',
  too_far: 'Too far away. Step in to about 6 to 10 feet.',
  head_cut: 'Your head is at the top of the picture. Tilt the phone back or step back.',
};

/** Judges one frame of image-space landmarks (x and y from 0 to 1, image not mirrored). */
export function assessFraming(
  landmarks: Landmark[] | null,
  meanLuma: number | null,
  config: PunchConfig = PUNCH_CONFIG,
  /** Picture width over height, since landmarks are fractions of each. */
  aspect = 4 / 3,
): FramingStatus {
  const { framing } = config;
  if (meanLuma !== null && meanLuma < framing.darkLuma) return 'too_dark';
  if (!landmarks) return 'no_person';

  const core = [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER, LM.LEFT_HIP, LM.RIGHT_HIP].map((i) => landmarks[i]);
  if (core.some((point) => !point)) return 'no_person';
  const inFrame = (point: Landmark) =>
    point.x >= framing.edgeMargin &&
    point.x <= 1 - framing.edgeMargin &&
    point.y >= framing.edgeMargin &&
    point.y <= 1 - framing.edgeMargin;
  if (core.some((point) => !inFrame(point))) return 'out_of_frame';

  const arms = [LM.LEFT_ELBOW, LM.RIGHT_ELBOW, LM.LEFT_WRIST, LM.RIGHT_WRIST].map((i) => landmarks[i]);
  const tracked = [...core, ...arms];
  const meanVisibility =
    tracked.reduce((sum, point) => sum + (point?.visibility ?? 0), 0) / tracked.length;
  if (meanVisibility < framing.minVisibility) return 'low_confidence';

  // Turned from the camera the shoulders look narrow, so the torso's height sets a floor on the size
  const left = landmarks[LM.LEFT_SHOULDER];
  const right = landmarks[LM.RIGHT_SHOULDER];
  const torso = ((landmarks[LM.LEFT_HIP].y + landmarks[LM.RIGHT_HIP].y) / 2 - (left.y + right.y) / 2) / aspect;
  const width = Math.max(Math.abs(left.x - right.x), torso * config.view.torsoToShoulderWidth);
  if (width > framing.tooCloseWidth) return 'too_close';
  if (width < framing.tooFarWidth) return 'too_far';
  const nose = landmarks[LM.NOSE];
  if (!nose || !inFrame(nose) || nose.y < framing.minHeadroom) return 'head_cut';
  return 'ok';
}

/** Mean brightness, 0 to 255, of RGBA pixels. */
export function meanLumaOf(rgba: ArrayLike<number>): number {
  let total = 0;
  const pixels = Math.floor(rgba.length / 4);
  if (pixels === 0) return 0;
  for (let i = 0; i < pixels; i += 1) {
    total += 0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2];
  }
  return total / pixels;
}

/** Stops a framing message flickering: problems must last before they show, and clear before they go. */
export class FramingMonitor {
  private shown: FramingStatus = 'ok';
  private candidate: FramingStatus = 'ok';
  private candidateSince = 0;

  constructor(private readonly config: PunchConfig = PUNCH_CONFIG) {}

  push(status: FramingStatus, t: number): FramingStatus {
    if (status !== this.candidate) {
      this.candidate = status;
      this.candidateSince = t;
    }
    const wait = status === 'ok' ? this.config.framing.clearAfterMs : this.config.framing.showAfterMs;
    if (status !== this.shown && t - this.candidateSince >= wait) this.shown = status;
    return this.shown;
  }
}

export type CameraProblem = 'unsupported' | 'insecure' | 'denied' | 'no_camera' | 'in_use' | 'model_failed' | 'unknown';

export const CAMERA_MESSAGES: Record<CameraProblem, { title: string; body: string }> = {
  unsupported: {
    title: "This browser can't run Punch Check",
    body: 'It needs camera access, WebAssembly and WebGL. Try a recent version of Chrome, Safari, Edge or Firefox.',
  },
  insecure: {
    title: 'The camera needs a secure page',
    body: 'Browsers only allow the camera on https pages. Open Clocked from its https address.',
  },
  denied: {
    title: 'Camera access is blocked',
    body: "Allow the camera for this site in your browser's settings, then try again.",
  },
  no_camera: {
    title: 'No camera found',
    body: 'Plug in or turn on a camera, then try again.',
  },
  in_use: {
    title: 'The camera is busy',
    body: 'Another app is using it. Close that app, then try again.',
  },
  model_failed: {
    title: "The pose tracker didn't load",
    body: 'Check your connection and try again. If it keeps happening, try a recent version of Chrome or Safari.',
  },
  unknown: {
    title: 'Camera unavailable',
    body: "The camera couldn't be started. Try again, or train without it.",
  },
};

/** Works out whether the browser can run this at all, before asking for anything. */
export function checkSupport(env: {
  hasGetUserMedia: boolean;
  hasWebAssembly: boolean;
  hasWebGL2: boolean;
  isSecureContext: boolean;
}): CameraProblem | null {
  // The model needs WebGL to read video frames even when it runs on the CPU
  if (!env.hasWebAssembly || !env.hasWebGL2) return 'unsupported';
  if (!env.isSecureContext) return 'insecure';
  if (!env.hasGetUserMedia) return 'unsupported';
  return null;
}

/** Maps a getUserMedia failure to something we can explain. */
export function cameraProblemFrom(error: unknown): CameraProblem {
  const name = (error as { name?: string } | null)?.name;
  switch (name) {
    case 'NotAllowedError':
    case 'SecurityError':
    case 'PermissionDeniedError':
      return 'denied';
    case 'NotFoundError':
    case 'OverconstrainedError':
    case 'DevicesNotFoundError':
      return 'no_camera';
    case 'NotReadableError':
    case 'AbortError':
    case 'TrackStartError':
      return 'in_use';
    default:
      return 'unknown';
  }
}
