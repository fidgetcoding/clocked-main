import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CoachVoice, coachVoice, parseManifest, type CoachVoiceDeps } from '@/lib/voice/coachVoice';
import { comboLine, lineForText, voiceLine } from '@/lib/voice/lines';
import { useVoiceStore } from '@/stores/voiceStore';

// The stores capture localStorage when they're created, so it has to exist before the imports run
vi.hoisted(() => {
  const data = new Map<string, string>();
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      getItem: (key: string) => data.get(key) ?? null,
      setItem: (key: string, value: string) => data.set(key, value),
      removeItem: (key: string) => data.delete(key),
    },
  });
});

class FakeUtterance {
  rate = 1;
  volume = 1;
  voice: unknown = null;
  constructor(public text: string) {}
}

interface FakeSource {
  buffer: { duration: number; url: string } | null;
  startedAt: number | null;
  stopped: boolean;
  onended: (() => void) | null;
  connect: () => void;
  start: (at: number) => void;
  stop: () => void;
}

function setup(clips: Record<string, string[]>, { on = true, random = 0, contextState = 'running' as AudioContextState } = {}) {
  const spoken: string[] = [];
  const speech = {
    speak: vi.fn((utterance: FakeUtterance) => {
      if (utterance.text) spoken.push(utterance.text);
    }),
    cancel: vi.fn(),
    getVoices: () => [],
  };
  const sources: FakeSource[] = [];
  const context = {
    state: contextState,
    currentTime: 5,
    destination: {},
    resume: vi.fn(async () => {
      context.state = 'running';
    }),
    decodeAudioData: vi.fn(async (data: { url: string }) => ({ duration: 0.5, url: data.url })),
    createBufferSource: () => {
      const source: FakeSource = {
        buffer: null,
        startedAt: null,
        stopped: false,
        onended: null,
        connect: () => undefined,
        start(at) {
          source.startedAt = at;
        },
        stop() {
          source.stopped = true;
        },
      };
      sources.push(source);
      return source;
    },
  };
  const fetched: string[] = [];
  let voiceOn = on;
  const deps: CoachVoiceDeps = {
    fetch: vi.fn(async (url: string) => {
      fetched.push(url);
      if (url.endsWith('manifest.json')) return { ok: true, json: async () => ({ version: 1, clips }), arrayBuffer: async () => new ArrayBuffer(0) };
      return { ok: true, json: async () => null, arrayBuffer: async () => ({ url }) as unknown as ArrayBuffer };
    }),
    createContext: () => context as unknown as AudioContext,
    speech: () => speech as unknown as SpeechSynthesis,
    isOn: () => voiceOn,
    random: () => random,
    baseUrl: '/',
  };
  const voice = new CoachVoice(deps);
  const played = () => sources.filter((source) => source.startedAt !== null).map((source) => source.buffer?.url);
  return { voice, spoken, speech, sources, played, fetched, context, setOn: (value: boolean) => (voiceOn = value) };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('the coach voice', () => {
  beforeEach(() => vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance));
  afterEach(() => vi.unstubAllGlobals());

  it('reads a line with the browser voice when nothing is recorded', async () => {
    const { voice, spoken, played } = setup({});
    await voice.loadManifest();
    voice.say(voiceLine('rec-next', 'rec-jab'));
    await settle();
    expect(spoken).toEqual(['Next. Throw 10 jabs']);
    expect(played()).toEqual([]);
  });

  it('plays the recorded clip instead of the browser voice', async () => {
    const { voice, spoken, played } = setup({ 'cue-hands-up': ['cue-hands-up.m4a'] });
    await voice.loadManifest();
    voice.say(lineForText('Hands up'));
    await settle();
    expect(played()).toEqual(['/voice/coach/cue-hands-up.m4a']);
    expect(spoken).toEqual([]);
  });

  it('stitches a combo from its pieces, one after another', async () => {
    const { voice, sources } = setup({
      'num-1': ['num-1.m4a'],
      'num-2': ['num-2.m4a'],
      'move-slip-left': ['move-slip-left.m4a'],
    });
    await voice.loadManifest();
    voice.say(comboLine(['1', '2', 'SLIP L']));
    await settle();
    expect(sources.map((source) => source.buffer?.url)).toEqual([
      '/voice/coach/num-1.m4a',
      '/voice/coach/num-2.m4a',
      '/voice/coach/move-slip-left.m4a',
    ]);
    const starts = sources.map((source) => source.startedAt!);
    expect(starts[1]).toBeGreaterThan(starts[0] + 0.5);
    expect(starts[2]).toBeGreaterThan(starts[1] + 0.5);
  });

  it('uses the browser voice for the whole line when any piece is missing, never two voices at once', async () => {
    const { voice, spoken, played } = setup({ 'num-1': ['num-1.m4a'] });
    await voice.loadManifest();
    voice.say(comboLine(['1', '2']));
    await settle();
    expect(played()).toEqual([]);
    expect(spoken).toEqual(['One, Two']);
  });

  it('picks among the takes at random', async () => {
    const takes = ['seg-rest.m4a', 'seg-rest-2.m4a', 'seg-rest-3.m4a'];
    const first = setup({ 'seg-rest': takes }, { random: 0 });
    const last = setup({ 'seg-rest': takes }, { random: 0.99 });
    for (const { voice } of [first, last]) {
      await voice.loadManifest();
      voice.say(voiceLine('seg-rest'));
    }
    await settle();
    expect(first.played()).toEqual(['/voice/coach/seg-rest.m4a']);
    expect(last.played()).toEqual(['/voice/coach/seg-rest-3.m4a']);
  });

  it('says nothing while muted', async () => {
    const { voice, spoken, played } = setup({ 'seg-rest': ['seg-rest.m4a'] }, { on: false });
    await voice.loadManifest();
    voice.say(voiceLine('seg-rest'));
    voice.say(lineForText('Hands up'));
    await settle();
    expect(spoken).toEqual([]);
    expect(played()).toEqual([]);
  });

  it('stopping cuts off a clip mid-line and the browser voice too', async () => {
    const { voice, sources, speech } = setup({ 'clock-3-2-1': ['clock-3-2-1.m4a'] });
    await voice.loadManifest();
    voice.say(voiceLine('clock-3-2-1'));
    await settle();
    speech.cancel.mockClear();
    voice.stop();
    expect(sources[0].stopped).toBe(true);
    expect(speech.cancel).toHaveBeenCalled();
  });

  it('a line muted while its clip is still loading never plays', async () => {
    const { voice, played, setOn } = setup({ 'seg-rest': ['seg-rest.m4a'] });
    await voice.loadManifest();
    voice.say(voiceLine('seg-rest'));
    setOn(false);
    await settle();
    expect(played()).toEqual([]);
  });

  it('a new line cuts off the one before', async () => {
    const { voice, sources } = setup({ 'seg-rest': ['seg-rest.m4a'], 'seg-shadowboxing': ['seg-shadowboxing.m4a'] });
    await voice.loadManifest();
    voice.say(voiceLine('seg-rest'));
    await settle();
    voice.say(voiceLine('seg-shadowboxing'));
    await settle();
    expect(sources[0].stopped).toBe(true);
    expect(sources[1].stopped).toBe(false);
  });

  it('a queued line waits for the one being said', async () => {
    const { voice, sources } = setup({ 'num-1': ['num-1.m4a'], 'num-2': ['num-2.m4a'] });
    await voice.loadManifest();
    voice.say(voiceLine('num-1'));
    await settle();
    voice.say(voiceLine('num-2'), { queued: true });
    await settle();
    expect(sources[0].stopped).toBe(false);
    expect(sources[1].startedAt!).toBeGreaterThanOrEqual(sources[0].startedAt! + 0.5);
  });

  it('preloads every take of a screen’s lines', async () => {
    const { voice, fetched } = setup({ 'seg-rest': ['seg-rest.m4a', 'seg-rest-2.m4a'], 'num-1': ['num-1.m4a'] });
    await voice.preload(['seg-rest', 'cue-hands-up']);
    await settle();
    expect(fetched).toEqual(['/voice/coach/manifest.json', '/voice/coach/seg-rest.m4a', '/voice/coach/seg-rest-2.m4a']);
  });

  it('falls back to the browser voice when audio cannot start', async () => {
    const { voice, spoken, context } = setup({ 'seg-rest': ['seg-rest.m4a'] }, { contextState: 'suspended' });
    context.resume.mockImplementation(() => new Promise(() => undefined));
    await voice.loadManifest();
    voice.say(voiceLine('seg-rest'));
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(spoken).toEqual(['Rest']);
  });

  it('treats a missing manifest as no clips', async () => {
    const { voice, spoken } = setup({});
    (voice as unknown as { deps: CoachVoiceDeps }).deps.fetch = vi.fn(async () => {
      throw new Error('offline');
    });
    await voice.loadManifest();
    voice.say(voiceLine('seg-rest'));
    expect(spoken).toEqual(['Rest']);
  });
});

describe('the manifest', () => {
  it('only takes bare clip file names', () => {
    expect(
      parseManifest({
        clips: {
          'seg-rest': ['seg-rest.m4a', '../secret.m4a', 'https://x.test/a.m4a', 7],
          'num-1': 'num-1.m4a',
          'num-2': [],
        },
      }),
    ).toEqual({ 'seg-rest': ['seg-rest.m4a'] });
    expect(parseManifest(null)).toEqual({});
  });
});

describe('the mute switch', () => {
  it('cuts off whatever is being said the moment it is muted', () => {
    const stop = vi.spyOn(coachVoice, 'stop');
    useVoiceStore.getState().setVoiceOn(true);
    stop.mockClear();
    useVoiceStore.getState().toggleVoice();
    expect(useVoiceStore.getState().voiceOn).toBe(false);
    expect(stop).toHaveBeenCalledTimes(1);
    useVoiceStore.getState().toggleVoice();
    expect(stop).toHaveBeenCalledTimes(1);
    stop.mockRestore();
  });
});
