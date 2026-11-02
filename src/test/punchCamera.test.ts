import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import { usePunchCamera } from '@/hooks/usePunchCamera';

const pose = vi.hoisted(() => ({
  release: vi.fn(),
  detect: vi.fn(() => ({ image: null, world: null })),
  acquire: vi.fn(),
}));

vi.mock('@/lib/punch/poseModel', () => ({
  PoseUnsupportedError: class extends Error {},
  acquirePoseModel: pose.acquire,
  releasePoseModel: pose.release,
  replacePoseModelWithCpu: vi.fn(),
}));

function fakeStream() {
  const track = { stop: vi.fn() };
  return { track, stream: { getTracks: () => [track] } as unknown as MediaStream };
}

function setup() {
  const video = document.createElement('video');
  video.play = vi.fn(async () => undefined);
  video.pause = vi.fn();
  const view = renderHook(() => usePunchCamera({ videoRef: { current: video }, onPose: vi.fn() }));
  return { video, ...view };
}

describe('usePunchCamera', () => {
  const getUserMedia = vi.fn();

  beforeEach(() => {
    getUserMedia.mockReset();
    pose.release.mockClear();
    pose.acquire.mockReset();
    pose.acquire.mockResolvedValue({ delegate: 'GPU', detect: pose.detect, close: vi.fn() });
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: { getUserMedia } });
    Object.defineProperty(window, 'isSecureContext', { configurable: true, value: true });
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ({})) as never);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('asks for nothing until started', () => {
    setup();
    expect(getUserMedia).not.toHaveBeenCalled();
    expect(pose.acquire).not.toHaveBeenCalled();
  });

  it('asks for video only, and sets what Safari needs to play it', async () => {
    const { stream } = fakeStream();
    getUserMedia.mockResolvedValue(stream);
    const { result, video } = setup();
    await act(() => result.current.start());
    expect(getUserMedia.mock.calls[0][0].audio).toBe(false);
    expect(video.getAttribute('muted')).toBe('');
    expect(video.getAttribute('playsinline')).toBe('');
    expect(video.muted).toBe(true);
    await waitFor(() => expect(result.current.status).toBe('live'));
    act(() => result.current.stop());
  });

  it('stops every track on stop and on unmount', async () => {
    const first = fakeStream();
    getUserMedia.mockResolvedValue(first.stream);
    const { result, unmount } = setup();
    await act(() => result.current.start());
    act(() => result.current.stop());
    expect(first.track.stop).toHaveBeenCalledTimes(1);
    expect(result.current.status).toBe('off');

    const second = fakeStream();
    getUserMedia.mockResolvedValue(second.stream);
    await act(() => result.current.start());
    unmount();
    expect(second.track.stop).toHaveBeenCalledTimes(1);
    expect(pose.acquire).toHaveBeenCalledTimes(1);
    expect(pose.release).toHaveBeenCalledTimes(1);
  });

  it('stops the camera if they left while the permission prompt was up', async () => {
    const { stream, track } = fakeStream();
    let grant: (value: MediaStream) => void = () => undefined;
    getUserMedia.mockReturnValue(new Promise<MediaStream>((resolve) => (grant = resolve)));
    const { result, unmount } = setup();
    let starting: Promise<void> = Promise.resolve();
    act(() => {
      starting = result.current.start();
    });
    // The prompt is up once it has asked
    await waitFor(() => expect(getUserMedia).toHaveBeenCalled());
    unmount();
    grant(stream);
    await starting;
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it('gives the model back if they left while it was loading', async () => {
    const { stream } = fakeStream();
    getUserMedia.mockResolvedValue(stream);
    let loaded: (value: unknown) => void = () => undefined;
    pose.acquire.mockReturnValue(new Promise((resolve) => (loaded = resolve)));
    const { result, unmount } = setup();
    let starting: Promise<void> = Promise.resolve();
    act(() => {
      starting = result.current.start();
    });
    await waitFor(() => expect(pose.acquire).toHaveBeenCalled());
    unmount();
    loaded({ delegate: 'GPU', detect: pose.detect, close: vi.fn() });
    await starting;
    expect(pose.release).toHaveBeenCalledTimes(1);
  });

  it('reuses its model across a stop and start', async () => {
    const { stream } = fakeStream();
    getUserMedia.mockResolvedValue(stream);
    const { result } = setup();
    await act(() => result.current.start());
    await waitFor(() => expect(result.current.status).toBe('live'));
    act(() => result.current.stop());
    await act(() => result.current.start());
    await waitFor(() => expect(result.current.status).toBe('live'));
    expect(pose.acquire).toHaveBeenCalledTimes(1);
    act(() => result.current.stop());
  });

  it.each([
    ['NotAllowedError', 'denied'],
    ['NotFoundError', 'no_camera'],
    ['NotReadableError', 'in_use'],
  ])('reports %s as %s', async (name, problem) => {
    getUserMedia.mockRejectedValue(Object.assign(new Error('x'), { name }));
    const { result } = setup();
    await act(() => result.current.start());
    expect(result.current.problem).toBe(problem);
    expect(result.current.status).toBe('off');
    expect(pose.acquire).not.toHaveBeenCalled();
  });

  it('does not blame permissions when a granted camera won\'t play, and lets the camera go', async () => {
    const { stream, track } = fakeStream();
    getUserMedia.mockResolvedValue(stream);
    const { result, video } = setup();
    video.play = vi.fn(async () => {
      throw Object.assign(new Error('x'), { name: 'NotAllowedError' });
    });
    await act(() => result.current.start());
    expect(result.current.problem).toBe('unknown');
    expect(track.stop).toHaveBeenCalledTimes(1);
  });

  it('lets the camera go when the model fails to load', async () => {
    const { stream, track } = fakeStream();
    getUserMedia.mockResolvedValue(stream);
    pose.acquire.mockRejectedValue(new Error('no model'));
    const { result } = setup();
    await act(() => result.current.start());
    expect(result.current.problem).toBe('model_failed');
    expect(track.stop).toHaveBeenCalledTimes(1);
    expect(pose.release).toHaveBeenCalledTimes(1);
  });

  it('turns away a browser with no way to ask for a camera', async () => {
    Object.defineProperty(navigator, 'mediaDevices', { configurable: true, value: undefined });
    const { result } = setup();
    await act(() => result.current.start());
    expect(result.current.problem).toBe('unsupported');
    expect(pose.acquire).not.toHaveBeenCalled();
  });
});
