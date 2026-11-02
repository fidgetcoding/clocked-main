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
}

declare global {
  interface Window {
    __sounds?: SoundLog;
  }
}

/** Runs in the page before any app code. What the app asks to play is logged, and nothing is played. */
function silenceBrowser() {
  if (window.__sounds) return;
  const sounds: SoundLog = { spoken: [], played: [] };
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
