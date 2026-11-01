// Checks the stubs in silent.ts. Needs only a served build of the app, not the rest of the stack.
import { expect, soundsPlayed, spokenWords, test } from "./silent";

const base = process.env.STACK_NO_BACKEND_URL as string;

test("speech is recorded, not spoken", async ({ page }) => {
  await page.goto(base);
  await page.evaluate(() => {
    const utterance = new SpeechSynthesisUtterance("Hands up");
    return new Promise<void>((resolve) => {
      utterance.addEventListener("end", () => resolve());
      window.speechSynthesis.speak(utterance);
    });
  });
  expect(await spokenWords(page)).toEqual(["Hands up"]);
  expect(await page.evaluate(() => window.speechSynthesis.getVoices().length)).toBe(0);
});

test("Web Audio never reaches the speakers", async ({ page }) => {
  await page.goto(base);
  const reached = await page.evaluate(() => {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.01);
    return context.destination.numberOfInputs >= 0 && gain.numberOfOutputs;
  });
  expect(reached).toBe(1);
  expect(await soundsPlayed(page)).toEqual(["web-audio:GainNode"]);
});

test("media elements are muted before they play", async ({ page }) => {
  await page.goto(base);
  const muted = await page.evaluate(() => {
    const audio = new Audio();
    // With nothing to load this never settles, so it isn't waited for
    audio.play().catch(() => undefined);
    return audio.muted;
  });
  expect(muted).toBe(true);
  expect((await soundsPlayed(page)).length).toBe(1);
});

test("contexts a test makes for itself are silent too", async ({ browser }) => {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(base);
  await page.evaluate(() => window.speechSynthesis.speak(new SpeechSynthesisUtterance("Bring it back")));
  expect(await spokenWords(page)).toEqual(["Bring it back"]);
  await context.close();
});
