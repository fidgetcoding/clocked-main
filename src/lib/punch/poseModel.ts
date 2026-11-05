import type { Landmark } from './types';

const ASSET_BASE = `${import.meta.env.BASE_URL}mediapipe`;

export type PoseDelegate = 'GPU' | 'CPU';

export interface PoseResult {
  /** x and y from 0 to 1 in the unmirrored image. Null means no person. */
  image: Landmark[] | null;
  /** Metres, hip-centred. Carries the image landmarks' visibility. */
  world: Landmark[] | null;
}

export interface PoseModel {
  delegate: PoseDelegate;
  detect: (video: HTMLVideoElement, timestampMs: number) => PoseResult;
  close: () => void;
}

/** How long an unused model stays loaded, so that turning the camera off and on doesn't reload it. */
const KEEP_LOADED_MS = 30000;

declare global {
  interface Window {
    __e2ePoseFeed?: (timestampMs: number) => PoseResult;
  }
}

/** Stable handle: every holder follows the replacement instead of retaining a closed GPU. */
class SharedPoseModel implements PoseModel {
  private replacing: Promise<SharedPoseModel> | null = null;
  private closed = false;
  constructor(private current: PoseModel) {}

  get delegate() { return this.current.delegate; }
  detect = (video: HTMLVideoElement, timestampMs: number) => this.current.detect(video, timestampMs);
  close = () => {
    if (this.closed) return;
    this.closed = true;
    this.current.close();
  };
  ready() { return this.replacing ?? Promise.resolve(this); }
  replaceWithCpu(): Promise<SharedPoseModel> {
    if (this.replacing) return this.replacing;
    if (this.delegate === 'CPU') return Promise.resolve(this);
    this.replacing = createPoseModel('CPU').then((cpu) => {
      if (this.closed) {
        cpu.close();
        throw new Error('Pose model released during CPU replacement');
      }
      const previous = this.current;
      this.current = cpu;
      previous.close();
      return this;
    }).finally(() => { this.replacing = null; });
    return this.replacing;
  }
}

let shared: Promise<SharedPoseModel> | null = null;
let holders = 0;
let closeTimer: ReturnType<typeof setTimeout> | null = null;

const closeShared = () => {
  const closing = shared;
  shared = null;
  closing?.then((model) => model.close()).catch(() => undefined);
};

/** Takes a hold on the one loaded model, loading it if needed. Pair with releasePoseModel. */
export function acquirePoseModel(): Promise<PoseModel> {
  if (closeTimer) clearTimeout(closeTimer);
  closeTimer = null;
  holders += 1;
  shared ??= createPoseModel('GPU').then((model) => new SharedPoseModel(model));
  // A failed load mustn't stick around for the next try
  const loading = shared;
  loading.catch(() => {
    if (shared === loading) shared = null;
  });
  return loading.then((model) => model.ready());
}

export function releasePoseModel() {
  holders = Math.max(0, holders - 1);
  if (holders > 0 || closeTimer) return;
  closeTimer = setTimeout(() => {
    closeTimer = null;
    if (holders === 0) closeShared();
  }, KEEP_LOADED_MS);
}

/** Replaces the loaded model with one on the CPU, after the GPU one has failed in use. */
export function replacePoseModelWithCpu(): Promise<PoseModel> {
  if (!shared) return Promise.reject(new Error('No acquired pose model to replace'));
  return shared.then((model) => model.replaceWithCpu());
}

/** The browser can't run the only wasm build we ship. */
export class PoseUnsupportedError extends Error {}

/** Loads the pose model from this site's own files. Imported on demand, so the app never pays for it unused. */
export async function createPoseModel(delegate: PoseDelegate = 'GPU'): Promise<PoseModel> {
  // Only in builds made for the browser tests, which feed in poses since they have no person or camera
  if (import.meta.env.VITE_E2E_POSE_FEED === '1' && window.__e2ePoseFeed) {
    const feed = window.__e2ePoseFeed;
    return { delegate: 'CPU', detect: (_video, timestampMs) => feed(timestampMs), close: () => undefined };
  }

  const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
  if (!(await FilesetResolver.isSimdSupported())) throw new PoseUnsupportedError('WebAssembly SIMD is not available');
  const fileset = await FilesetResolver.forVisionTasks(`${ASSET_BASE}/wasm`);

  const create = (choice: PoseDelegate) =>
    PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: `${ASSET_BASE}/pose_landmarker_lite.task`, delegate: choice },
      runningMode: 'VIDEO',
      numPoses: 1,
    });

  let used = delegate;
  let landmarker;
  try {
    landmarker = await create(delegate);
  } catch (error) {
    if (delegate !== 'GPU') throw error;
    console.warn('Pose model could not use the GPU, falling back to the CPU:', error);
    used = 'CPU';
    landmarker = await create('CPU');
  }

  return {
    delegate: used,
    detect: (video, timestampMs) => {
      const result = landmarker.detectForVideo(video, timestampMs);
      const image = result.landmarks[0] ?? null;
      const world = result.worldLandmarks[0] ?? null;
      return {
        image,
        world: world && world.map((point, i) => ({ ...point, visibility: image?.[i]?.visibility ?? point.visibility })),
      };
    },
    close: () => landmarker.close(),
  };
}
