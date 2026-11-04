import { useVoiceStore } from '@/stores/voiceStore';
import { lineIds, lineText, type VoiceLine } from './lines';

/** public/voice/coach/manifest.json, written by `npm run voice:import`. Each id lists its takes. */
export interface VoiceManifest {
  version: 1;
  clips: Record<string, string[]>;
}

export interface SayOptions {
  /** Browser voice speed. Recorded clips play as recorded. */
  rate?: number;
  /** Wait for whatever is being said instead of cutting it off. */
  queued?: boolean;
  /** Only say it in the recorded voice: with no clip, say nothing rather than reading it out. */
  recordedOnly?: boolean;
}

export interface CoachVoiceDeps {
  fetch: (url: string) => Promise<Pick<Response, 'ok' | 'json' | 'arrayBuffer'>>;
  createContext: () => AudioContext | null;
  speech: () => SpeechSynthesis | null;
  isOn: () => boolean;
  random: () => number;
  /** Where public/ is served from. */
  baseUrl: string;
}

/** A beat between the pieces of a stitched line, like a coach taking a breath between punches. */
const PIECE_GAP_S = 0.06;
/** How long to wait for audio to wake up before reading the line with the browser voice instead. */
const RESUME_WAIT_MS = 300;

export function parseManifest(value: unknown): Record<string, string[]> {
  const clips = (value as Partial<VoiceManifest> | null)?.clips;
  if (!clips || typeof clips !== 'object') return {};
  const out: Record<string, string[]> = {};
  for (const [id, files] of Object.entries(clips)) {
    if (!Array.isArray(files)) continue;
    // A take is a bare file name. Nothing outside the coach folder gets loaded.
    const safe = files.filter((file): file is string => typeof file === 'string' && /^[a-z0-9-]+\.(m4a|mp3|wav|ogg|webm)$/.test(file));
    if (safe.length > 0) out[id] = safe;
  }
  return out;
}

/**
 * Says a line in the recorded coach voice when every piece of it has a clip, and in the browser's
 * voice when any piece doesn't, so a half-recorded line never comes out in two voices.
 */
export class CoachVoice {
  private clips: Record<string, string[]> | null = null;
  private manifest: Promise<void> | null = null;
  private buffers = new Map<string, Promise<AudioBuffer | null>>();
  private context: AudioContext | null = null;
  private playing = new Set<AudioBufferSourceNode>();
  private endsAt = 0;
  private token = 0;
  private playbackQueue: Promise<void> = Promise.resolve();

  constructor(private readonly deps: CoachVoiceDeps) {}

  /** Call from a tap: browsers only start audio from one. */
  initialize() {
    const speech = this.deps.speech();
    if (speech) {
      speech.getVoices();
      const warmUp = new SpeechSynthesisUtterance('');
      warmUp.volume = 0;
      speech.speak(warmUp);
    }
    const context = this.getContext();
    if (context?.state === 'suspended') void context.resume().catch(() => undefined);
    void this.loadManifest();
  }

  loadManifest(): Promise<void> {
    this.manifest ??= this.deps
      .fetch(`${this.deps.baseUrl}voice/coach/manifest.json`)
      .then((response) => (response.ok ? response.json() : null))
      .then((value) => {
        this.clips = parseManifest(value);
      })
      .catch(() => {
        this.clips = {};
      });
    return this.manifest;
  }

  /** Fetches and decodes every take of these lines, so the screen's first line doesn't lag. */
  async preload(ids: string[]) {
    await this.loadManifest();
    for (const id of ids) for (const file of this.clips?.[id] ?? []) void this.buffer(this.url(file));
  }

  /** Whether every piece of a line has a recorded take. */
  hasClips(line: VoiceLine) {
    return line.length > 0 && line.every((piece) => piece.id !== null && (this.clips?.[piece.id]?.length ?? 0) > 0);
  }

  /** Says a line. Returns false when nothing was said: the voice is off, or a recorded-only line has no clip. */
  say(line: VoiceLine, options: SayOptions = {}): boolean {
    if (!this.deps.isOn() || line.length === 0) return false;
    if (options.recordedOnly && !this.hasClips(line)) return false;
    if (!options.queued) this.stop();
    if (!this.hasClips(line)) {
      this.speak(lineText(line), options);
      return true;
    }
    const urls = lineIds(line).map((id) => {
      const takes = this.clips![id];
      return this.url(takes[Math.floor(this.deps.random() * takes.length) % takes.length]);
    });
    const token = this.token;
    this.playbackQueue = this.playbackQueue
      .then(() => {
        if (token === this.token && this.deps.isOn()) return this.play(urls, line, options, token);
      })
      .catch((error) => console.warn("Coach playback failed:", error));
    return true;
  }

  /** Cuts off whatever is being said, clip or browser voice. */
  stop() {
    this.token += 1;
    this.playbackQueue = Promise.resolve();
    for (const source of this.playing) {
      try {
        source.stop();
      } catch {
        // Already finished
      }
    }
    this.playing.clear();
    this.endsAt = 0;
    this.deps.speech()?.cancel();
  }

  private async play(urls: string[], line: VoiceLine, options: SayOptions, token: number) {
    const context = this.getContext();
    const buffers = await Promise.all(urls.map((url) => this.buffer(url)));
    if (token !== this.token || !this.deps.isOn()) return;
    if (!context || buffers.some((buffer) => !buffer) || !(await this.awake(context))) {
      // A clip that won't load falls back to the browser voice, unless the line is only ever recorded
      if (token === this.token && !options.recordedOnly) this.speak(lineText(line), options);
      return;
    }
    if (token !== this.token || !this.deps.isOn()) return;
    let at = Math.max(context.currentTime + 0.01, options.queued ? this.endsAt : 0);
    for (const buffer of buffers as AudioBuffer[]) {
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.connect(context.destination);
      source.onended = () => this.playing.delete(source);
      source.start(at);
      this.playing.add(source);
      at += buffer.duration + PIECE_GAP_S;
    }
    this.endsAt = at;
  }

  private speak(text: string, options: SayOptions) {
    const speech = this.deps.speech();
    if (!speech) return;
    try {
      if (!options.queued) speech.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = options.rate ?? 0.9;
      const english = speech.getVoices().find((voice) => voice.lang.startsWith('en'));
      if (english) utterance.voice = english;
      speech.speak(utterance);
    } catch (error) {
      console.warn('Speech synthesis error:', error);
    }
  }

  private async awake(context: AudioContext) {
    if (context.state === 'running') return true;
    await Promise.race([context.resume().catch(() => undefined), new Promise((resolve) => setTimeout(resolve, RESUME_WAIT_MS))]);
    return (context.state as AudioContextState) === 'running';
  }

  private buffer(url: string) {
    let pending = this.buffers.get(url);
    if (!pending) {
      const context = this.getContext();
      if (!context) return Promise.resolve(null);
      pending = this.deps
            .fetch(url)
            .then((response) => (response.ok ? response.arrayBuffer() : Promise.reject(new Error(`${url} ${String(response.ok)}`))))
            .then((data) => context.decodeAudioData(data))
            .catch(() => {
              // Try again next time rather than remembering the failure
              this.buffers.delete(url);
              return null;
            });
      this.buffers.set(url, pending);
    }
    return pending;
  }

  private getContext() {
    if (!this.context) {
      try {
        this.context = this.deps.createContext();
      } catch {
        this.context = null;
      }
    }
    return this.context;
  }

  private url(file: string) {
    return `${this.deps.baseUrl}voice/coach/${file}`;
  }
}

export const coachVoice = new CoachVoice({
  fetch: (url) => fetch(url),
  createContext: () => {
    const Context = window.AudioContext ?? window.webkitAudioContext;
    return Context ? new Context() : null;
  },
  speech: () => (typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null),
  isOn: () => useVoiceStore.getState().voiceOn,
  random: Math.random,
  baseUrl: import.meta.env.BASE_URL ?? '/',
});

// Muting from anywhere cuts off the line being said
useVoiceStore.subscribe((state, previous) => {
  if (previous.voiceOn && !state.voiceOn) coachVoice.stop();
});
