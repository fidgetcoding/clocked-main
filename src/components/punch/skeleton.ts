import { LM } from '@/lib/punch/body';
import type { Landmark } from '@/lib/punch/types';

const BONES: [number, number][] = [
  [LM.LEFT_SHOULDER, LM.RIGHT_SHOULDER],
  [LM.LEFT_SHOULDER, LM.LEFT_ELBOW],
  [LM.LEFT_ELBOW, LM.LEFT_WRIST],
  [LM.RIGHT_SHOULDER, LM.RIGHT_ELBOW],
  [LM.RIGHT_ELBOW, LM.RIGHT_WRIST],
  [LM.LEFT_SHOULDER, LM.LEFT_HIP],
  [LM.RIGHT_SHOULDER, LM.RIGHT_HIP],
  [LM.LEFT_HIP, LM.RIGHT_HIP],
];

const JOINTS = [
  LM.NOSE,
  LM.LEFT_SHOULDER,
  LM.RIGHT_SHOULDER,
  LM.LEFT_ELBOW,
  LM.RIGHT_ELBOW,
  LM.LEFT_WRIST,
  LM.RIGHT_WRIST,
  LM.LEFT_HIP,
  LM.RIGHT_HIP,
];

const BONE = '#D4FF00';
const JOINT = '#F5F6F3';
const JOINT_EDGE = '#07080B';
const MIN_VISIBILITY = 0.5;

/** Draws the tracked body onto a canvas sized to the video. The caller's CSS does the mirroring. */
export function drawSkeleton(canvas: HTMLCanvasElement, video: HTMLVideoElement, landmarks: Landmark[] | null) {
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  context.clearRect(0, 0, canvas.width, canvas.height);
  if (!landmarks) return;

  const scale = Math.max(canvas.width, canvas.height) / 640;
  const seen = (point: Landmark | undefined): point is Landmark =>
    !!point && (point.visibility ?? 1) >= MIN_VISIBILITY;

  context.strokeStyle = BONE;
  context.lineWidth = 4 * scale;
  context.lineCap = 'round';
  context.beginPath();
  for (const [from, to] of BONES) {
    const a = landmarks[from];
    const b = landmarks[to];
    if (!seen(a) || !seen(b)) continue;
    context.moveTo(a.x * canvas.width, a.y * canvas.height);
    context.lineTo(b.x * canvas.width, b.y * canvas.height);
  }
  context.stroke();

  context.fillStyle = JOINT;
  context.strokeStyle = JOINT_EDGE;
  context.lineWidth = 1.5 * scale;
  for (const index of JOINTS) {
    const point = landmarks[index];
    if (!seen(point)) continue;
    context.beginPath();
    context.arc(point.x * canvas.width, point.y * canvas.height, 4.5 * scale, 0, Math.PI * 2);
    context.fill();
    context.stroke();
  }
}
