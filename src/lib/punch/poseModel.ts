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

/** The browser can't run the only wasm build we ship. */
export class PoseUnsupportedError extends Error {}

/** Loads the pose model from this site's own files. Imported on demand, so the app never pays for it unused. */
export async function createPoseModel(delegate: PoseDelegate = 'GPU'): Promise<PoseModel> {
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
