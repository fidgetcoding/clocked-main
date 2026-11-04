// Every browser test goes through here, so that none can make a sound on the machine running it.
// Import `test` and `expect` from this file, never from @playwright/test. A check in
// src/test/e2eSilence.test.ts fails the suite if a spec doesn't.
import { test as base, expect, type Browser, type Page, type PlaywrightWorkerArgs } from "@playwright/test";

export { expect };

/**
 * Launch settings that mute each engine. They can't stop everything: on a Mac speechSynthesis goes
 * through the system, not the browser, which is why silenceBrowser below stubs it out as well.
 */
export const silentLaunch = {
  chromium: { headless: true, args: ["--mute-audio"] },
  firefox: { headless: true, firefoxUserPrefs: { "media.volume_scale": "0.0" } },
  webkit: { headless: true },
};

interface SoundLog {
  spoken: string[];
  played: string[];
  clips: string[];
}

declare global {
  interface Window {
    __sounds?: SoundLog;
  }
}

/** Runs in the page before any app code. What the app asks to play is logged, and nothing is played. */
function silenceBrowser() {
  if (window.__sounds) return;
  const sounds: SoundLog = { spoken: [], played: [], clips: [] };
  window.__sounds = sounds;

  const fakeSpeech = {
    speaking: false,
    pending: false,
    paused: false,
    onvoiceschanged: null,
    speak(utterance: SpeechSynthesisUtterance) {
      sounds.spoken.push(utterance.text);
      // Callers that wait for the end of an utterance still get it
      setTimeout(() => utterance.dispatchEvent(new Event("end")), 0);
    },
    cancel() {},
    pause() {},
    resume() {},
    getVoices: () => [],
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => true,
  };
  Object.defineProperty(window, "speechSynthesis", { configurable: true, get: () => fakeSpeech });

  // Track the real fetched bytes through decode and playback. Preloading a file alone must not
  // satisfy a voice assertion. Keep the original fetch, decoder, buffers and scheduling behavior.
  const encoded = new WeakMap<ArrayBuffer, string>();
  const decoded = new WeakMap<AudioBuffer, string>();
  const fetch = window.fetch.bind(window);
  window.fetch = async (...args) => {
    const response = await fetch(...args);
    if (response.url.includes('/voice/coach/') && !response.url.endsWith('.json')) {
      const arrayBuffer = response.arrayBuffer.bind(response);
      response.arrayBuffer = async () => {
        const bytes = await arrayBuffer();
        encoded.set(bytes, new URL(response.url).pathname.split('/').pop()!);
        return bytes;
      };
    }
    return response;
  };
  const decode = BaseAudioContext.prototype.decodeAudioData;
  BaseAudioContext.prototype.decodeAudioData = function (bytes, success, failure) {
    const file = encoded.get(bytes);
    const remember = (buffer: AudioBuffer) => { if (file) decoded.set(buffer, file); return buffer; };
    return decode.call(this, bytes, success ? (buffer) => success(remember(buffer)) : undefined, failure).then(remember);
  };
  const start = AudioBufferSourceNode.prototype.start;
  AudioBufferSourceNode.prototype.start = function (...args) {
    const file = this.buffer && decoded.get(this.buffer);
    if (file) sounds.clips.push(file);
    return start.apply(this, args);
  };

  // Web Audio only makes sound once something reaches the destination, so nothing gets to
  const connect = AudioNode.prototype.connect as (this: AudioNode, ...args: unknown[]) => unknown;
  AudioNode.prototype.connect = function (this: AudioNode, ...args: unknown[]) {
    if (args[0] instanceof AudioDestinationNode) {
      sounds.played.push(`web-audio:${this.constructor.name}`);
      return args[0];
    }
    return connect.apply(this, args);
  } as typeof AudioNode.prototype.connect;

  const play = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
    this.muted = true;
    sounds.played.push(`media:${this.currentSrc || this.tagName.toLowerCase()}`);
    return play.call(this);
  };
}

const silenceNewContexts = (browser: Browser) => {
  const newContext = browser.newContext.bind(browser);
  browser.newContext = async (options) => {
    const context = await newContext(options);
    await context.addInitScript(silenceBrowser);
    return context;
  };
};

/** A muted Chromium with flags of its own, for what can only be set when the browser starts, like its camera. */
export async function launchSilentChromium(playwright: PlaywrightWorkerArgs["playwright"], args: string[]): Promise<Browser> {
  const browser = await playwright.chromium.launch({ ...silentLaunch.chromium, args: [...silentLaunch.chromium.args, ...args] });
  silenceNewContexts(browser);
  return browser;
}

export const test = base.extend<object, { silentBrowser: void }>({
  silentBrowser: [
    async ({ browser }, provide) => {
      silenceNewContexts(browser);
      await provide();
    },
    { scope: "worker", auto: true },
  ],
  context: async ({ context }, provide) => {
    await context.addInitScript(silenceBrowser);
    await provide(context);
  },
});

/** Everything the page has asked to say out loud so far. */
export const spokenWords = (page: Page) => page.evaluate(() => window.__sounds?.spoken ?? []);

/** Every other sound the page has asked to play so far. */
export const soundsPlayed = (page: Page) => page.evaluate(() => window.__sounds?.played ?? []);

/** Shipped clip filenames actually scheduled for playback, excluding downloads and decodes alone. */
export const clipsPlayed = (page: Page) => page.evaluate(() => window.__sounds?.clips ?? []);
