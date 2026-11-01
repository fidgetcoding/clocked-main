import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acquirePoseModel, createPoseModel, PoseUnsupportedError, releasePoseModel, replacePoseModelWithCpu } from '@/lib/punch/poseModel';

const vision = vi.hoisted(() => ({
  forVisionTasks: vi.fn(async (path: string) => ({ path })),
  isSimdSupported: vi.fn(async () => true),
  createFromOptions: vi.fn(),
}));

vi.mock('@mediapipe/tasks-vision', () => ({
  FilesetResolver: { forVisionTasks: vision.forVisionTasks, isSimdSupported: vision.isSimdSupported },
  PoseLandmarker: { createFromOptions: vision.createFromOptions },
}));

const landmarker = {
  close: vi.fn(),
  detectForVideo: vi.fn(() => ({
    landmarks: [[{ x: 0.5, y: 0.5, z: 0, visibility: 0.9 }]],
    worldLandmarks: [[{ x: 0.1, y: -0.2, z: 0.3, visibility: 0 }]],
  })),
};

describe('createPoseModel', () => {
  beforeEach(() => {
    vision.createFromOptions.mockReset();
    vision.forVisionTasks.mockClear();
  });

  it('loads everything from this site, in video mode, on the GPU first', async () => {
    vision.createFromOptions.mockResolvedValue(landmarker);
    const model = await createPoseModel();
    expect(model.delegate).toBe('GPU');
    expect(vision.forVisionTasks).toHaveBeenCalledWith('/mediapipe/wasm');
    expect(vision.createFromOptions).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        runningMode: 'VIDEO',
        numPoses: 1,
        baseOptions: { modelAssetPath: '/mediapipe/pose_landmarker_lite.task', delegate: 'GPU' },
      }),
    );
  });

  it('turns away browsers without SIMD instead of asking for a wasm file we do not ship', async () => {
    vision.isSimdSupported.mockResolvedValueOnce(false);
    await expect(createPoseModel()).rejects.toBeInstanceOf(PoseUnsupportedError);
    expect(vision.forVisionTasks).not.toHaveBeenCalled();
  });

  it('falls back to the CPU when the GPU fails', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vision.createFromOptions.mockRejectedValueOnce(new Error('no GPU')).mockResolvedValueOnce(landmarker);
    const model = await createPoseModel();
    expect(model.delegate).toBe('CPU');
    expect(vision.createFromOptions.mock.calls[1][1].baseOptions.delegate).toBe('CPU');
  });

  it('reports a failure when the CPU fails too', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    vision.createFromOptions.mockRejectedValue(new Error('broken'));
    await expect(createPoseModel()).rejects.toThrow('broken');
  });

  it('gives world landmarks the visibility from the image landmarks', async () => {
    vision.createFromOptions.mockResolvedValue(landmarker);
    const model = await createPoseModel();
    const result = model.detect({} as HTMLVideoElement, 1);
    expect(result.world?.[0].visibility).toBe(0.9);
    expect(result.image?.[0].x).toBe(0.5);
  });

  describe('the shared model', () => {
    const settle = async (ms: number) => {
      await vi.advanceTimersByTimeAsync(ms);
    };
    const freshClose = () => {
      const close = vi.fn();
      vision.createFromOptions.mockResolvedValue({ ...landmarker, close });
      return close;
    };

    beforeEach(() => vi.useFakeTimers());
    afterEach(async () => {
      // Runs out the keep-loaded timer so one test's model can't reach the next
      await settle(60000);
      vi.useRealTimers();
    });

    it('turning the camera off and on keeps one model, loaded once', async () => {
      const close = freshClose();
      const first = await acquirePoseModel();
      releasePoseModel();
      await settle(5000);
      const second = await acquirePoseModel();
      expect(second).toBe(first);
      expect(vision.createFromOptions).toHaveBeenCalledTimes(1);
      expect(close).not.toHaveBeenCalled();
      releasePoseModel();
    });

    it('frees the model once nobody has needed it for a while', async () => {
      const close = freshClose();
      await acquirePoseModel();
      releasePoseModel();
      await settle(29000);
      expect(close).not.toHaveBeenCalled();
      await settle(2000);
      expect(close).toHaveBeenCalledTimes(1);
      await acquirePoseModel();
      expect(vision.createFromOptions).toHaveBeenCalledTimes(2);
      releasePoseModel();
    });

    it('stays loaded while anyone still holds it', async () => {
      const close = freshClose();
      await acquirePoseModel();
      await acquirePoseModel();
      releasePoseModel();
      await settle(60000);
      expect(close).not.toHaveBeenCalled();
      releasePoseModel();
    });

    it('tries again after a load that failed', async () => {
      vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      vision.createFromOptions.mockRejectedValue(new Error('broken'));
      await expect(acquirePoseModel()).rejects.toThrow('broken');
      releasePoseModel();
      freshClose();
      vision.createFromOptions.mockClear();
      await expect(acquirePoseModel()).resolves.toBeTruthy();
      expect(vision.createFromOptions).toHaveBeenCalledTimes(1);
      releasePoseModel();
    });

    it('swaps to the CPU in place when the GPU fails in use', async () => {
      const close = freshClose();
      await acquirePoseModel();
      const cpu = await replacePoseModelWithCpu();
      await settle(0);
      expect(cpu.delegate).toBe('CPU');
      expect(close).toHaveBeenCalledTimes(1);
      expect(await acquirePoseModel()).toBe(cpu);
      releasePoseModel();
      releasePoseModel();
    });
  });

  it('returns nulls when there is no person', async () => {
    vision.createFromOptions.mockResolvedValue({
      ...landmarker,
      detectForVideo: () => ({ landmarks: [], worldLandmarks: [] }),
    });
    const model = await createPoseModel();
    expect(model.detect({} as HTMLVideoElement, 1)).toEqual({ image: null, world: null });
  });
});
