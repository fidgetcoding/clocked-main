// One switch mutes everything the app says, from every screen that talks. Needs only a served build of the app.
import { readFileSync } from "node:fs";
import type { Page } from "@playwright/test";
import { clipsPlayed, expect, soundsPlayed, spokenWords, test } from "./silent";
import { pauseButton, playButton, skipButton } from "./controls";
import { finishGuestOnboarding, NO_BACKEND_URL } from "./helpers";

const voiceSwitch = (page: Page) => page.getByRole("switch", { name: "Coach voice", exact: true });

const voiceCalls = async (page: Page) =>
  (await spokenWords(page)).filter(Boolean).length +
  (await soundsPlayed(page)).filter((sound) => sound === "web-audio:AudioBufferSourceNode").length;

const VIEWPORTS = [
  { name: "phone", width: 390, height: 844 },
  { name: "laptop", width: 1280, height: 800 },
];

// A canvas for a camera, so Punch Check gets to its live screen without touching a real one
const fakeCamera = (page: Page) =>
  page.context().addInitScript(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext("2d") as CanvasRenderingContext2D;
    setInterval(() => context.fillRect(0, 0, 640, 480), 33);
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => canvas.captureStream(30) } });
    // Nobody in the picture, through the e2e build's pose feed
    const nobody = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, z: 0, visibility: 0 }));
    (window as unknown as { __e2ePoseFeed: () => unknown }).__e2ePoseFeed = () => ({ image: nobody, world: nobody });
  });

// The stage can swap layouts as it settles, so measure until it has
const expectInView = async (page: Page) => {
  const button = voiceSwitch(page).first();
  await expect(button).toBeVisible();
  const viewport = page.viewportSize()!;
  await expect
    .poll(async () => {
      const box = await button.boundingBox();
      return !!box && box.x >= 0 && box.y >= 0 && box.x + box.width <= viewport.width && box.y + box.height <= viewport.height;
    })
    .toBe(true);
};

for (const viewport of VIEWPORTS) {
  test(`muting on the workout clock silences the calls, and it stays muted (${viewport.name})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await finishGuestOnboarding(page, NO_BACKEND_URL, "Quiet Please");
    await playButton(page).click();
    await page.waitForURL("**/workout/**");
    await playButton(page).click();

    await expectInView(page);
    await expect(voiceSwitch(page)).toHaveAttribute("aria-checked", "true");
    const skip = skipButton(page);
    for (let i = 0; i < 10 && (await voiceCalls(page)) === 0; i++) await skip.click();
    await expect.poll(() => voiceCalls(page)).toBeGreaterThan(0);

    await voiceSwitch(page).click();
    await expect(voiceSwitch(page)).toHaveAttribute("aria-checked", "false");
    // Anything already queued, like a combo after its announcement, has had its chance
    await page.waitForTimeout(1500);
    const before = await voiceCalls(page);
    for (let i = 0; i < 4; i++) await skip.click();
    await page.waitForTimeout(1500);
    expect(await voiceCalls(page)).toBe(before);

    // The same switch in Settings, and remembered
    await page.goto(`${NO_BACKEND_URL}/settings`);
    await expect(page.getByRole("switch", { name: "Coach Voice", exact: true })).toHaveAttribute("aria-checked", "false");
    await page.getByRole("switch", { name: "Coach Voice", exact: true }).click();
    await page.goto(`${NO_BACKEND_URL}/quick-session`);
    await page.getByText("QUICK SESSION").waitFor();
    await expectInView(page);
    await expect(voiceSwitch(page)).toHaveAttribute("aria-checked", "true");
  });

  test(`Punch Check and calibration both have the switch (${viewport.name})`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await fakeCamera(page);
    await finishGuestOnboarding(page, NO_BACKEND_URL, "Check Voice");

    await page.goto(`${NO_BACKEND_URL}/punch-check`);
    await expect(voiceSwitch(page)).toHaveAttribute("aria-checked", "true");
    await voiceSwitch(page).click();
    await page.getByRole("button", { name: "Start camera" }).click();
    await expect(page.getByTestId("punch-fps")).toBeVisible({ timeout: 20_000 });
    await expectInView(page);
    await expect(voiceSwitch(page).first()).toHaveAttribute("aria-checked", "false");
    // The calibration sheet has its own copy of the same switch
    const sheetSwitch = page.getByTestId("calibration").getByRole("switch", { name: "Coach voice", exact: true });
    await expect(sheetSwitch).toBeVisible();
    await sheetSwitch.click();
    await expect(sheetSwitch).toHaveAttribute("aria-checked", "true");
    await expect(voiceSwitch(page).first()).toHaveAttribute("aria-checked", "true");

    await page.goto(`${NO_BACKEND_URL}/punch-check?record=1`);
    await expect(page.getByTestId("punch-recorder")).toBeVisible();
    await expectInView(page);
    await voiceSwitch(page).click();
    await expect(voiceSwitch(page)).toHaveAttribute("aria-checked", "false");
  });
}

test("calibration speaks its prompts, and a mute stops the next one", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fakeCamera(page);
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Calibrate Voice");
  await page.goto(`${NO_BACKEND_URL}/punch-check?record=1`);
  await page.getByRole("button", { name: "Start" }).click();
  await expect.poll(() => voiceCalls(page), { timeout: 30_000 }).toBeGreaterThan(0);
  expect((await spokenWords(page)).filter(Boolean)).not.toContain("Next. Stand still in your guard");

  await voiceSwitch(page).click();
  const before = await voiceCalls(page);
  // The guard step is 4 seconds to get ready and then "Go"
  await page.waitForTimeout(5000);
  expect(await voiceCalls(page)).toBe(before);
});

// Stands in for Nate's recordings: a short tone as every calibration clip
const withRecordedCalibration = (page: Page) =>
  Promise.all([
    page.route("**/voice/coach/manifest.json", (route) =>
      route.fulfill({
        json: { version: 1, clips: { "rec-next": ["rec-next.m4a"], "rec-guard": ["rec-guard.m4a", "rec-guard-2.m4a"], "rec-go": ["rec-go.m4a"] } },
      }),
    ),
    page.route("**/voice/coach/*.m4a", (route) =>
      route.fulfill({ contentType: "audio/mp4", body: readFileSync("tests/e2e/fixtures/voice-clip.m4a") }),
    ),
  ]);

test("recorded clips play instead of the browser voice, and the rest falls back to it", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fakeCamera(page);
  await withRecordedCalibration(page);
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Recorded");
  await page.goto(`${NO_BACKEND_URL}/punch-check?record=1`);
  await page.getByRole("button", { name: "Start" }).click();

  // "Next. Stand still in your guard" is recorded, so it plays as two clips and isn't spoken
  await expect.poll(async () => (await soundsPlayed(page)).filter((sound) => sound === "web-audio:AudioBufferSourceNode").length, { timeout: 30_000 }).toBeGreaterThanOrEqual(2);
  expect(await spokenWords(page)).not.toContain("Next. Stand still in your guard");
  // "Go" after the guard step is recorded too
  await expect.poll(async () => (await soundsPlayed(page)).filter((sound) => sound === "web-audio:AudioBufferSourceNode").length, { timeout: 10_000 }).toBeGreaterThanOrEqual(3);
  // The jab step isn't recorded, so the whole line uses the browser voice
  await page.getByRole("button", { name: "Done, next" }).click();
  await expect.poll(() => spokenWords(page)).toContain("Next. Throw 10 jabs");

  await voiceSwitch(page).click();
  const played = (await soundsPlayed(page)).length;
  const spoken = (await spokenWords(page)).length;
  await page.waitForTimeout(5000);
  expect((await soundsPlayed(page)).length).toBe(played);
  expect((await spokenWords(page)).length).toBe(spoken);
});

// Use the shipped recording, with no audio routes or synthetic voice fixture.
test("all shipped coach clips decode and the workout uses recordings", async ({ page }) => {
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Nate Voice");
  const decoded = await page.evaluate(async () => {
    const manifest = await fetch("/voice/coach/manifest.json").then((r) => r.json());
    const files = [...new Set(Object.values(manifest.clips).flat())] as string[];
    const context = new OfflineAudioContext(1, 1, 44100);
    let shortest = Infinity;
    for (const file of files) {
      const response = await fetch(`/voice/coach/${file}`);
      if (!response.ok) throw new Error(`Missing clip: ${file}`);
      const buffer = await context.decodeAudioData(await response.arrayBuffer());
      if (buffer.duration < 0.15 || buffer.duration > 5) throw new Error(`Bad clip: ${file}`);
      shortest = Math.min(shortest, buffer.duration);
    }
    return { cues: Object.keys(manifest.clips).length, takes: files.length, shortest };
  });
  expect(decoded.cues).toBe(174);
  expect(decoded.takes).toBe(180);

  await playButton(page).click();
  await page.waitForURL("**/workout/**");
  await playButton(page).click();
  const skip = skipButton(page);
  for (let i = 0; i < 4; i++) {
    await skip.click();
    await page.waitForTimeout(400);
  }
  await expect.poll(async () => (await soundsPlayed(page)).filter((s) => s === "web-audio:AudioBufferSourceNode").length).toBeGreaterThan(0);
  expect((await spokenWords(page)).filter(Boolean)).toEqual([]);
});

test('the first workout announcement plays, and pausing cancels its delayed combo', async ({ page }) => {
  await finishGuestOnboarding(page, NO_BACKEND_URL, 'Voice Timing');
  const id = await page.evaluate(() => {
    const stored = JSON.parse(localStorage.getItem('get-clocked-workouts')!);
    const workout = stored.state.guestWorkouts[0];
    workout.phases = [{
      id: 'voice-round', name: 'Voice round', section: 'grind', repeats: 1,
      combos: [['1', '2']], comboOrder: 'sequential',
      segments: [{ id: 'voice-combo', name: 'Heavy Bag', type: 'active', segmentType: 'combo', duration: 120 }],
    }];
    localStorage.setItem('get-clocked-workouts', JSON.stringify(stored));
    return workout.id;
  });
  await page.goto(`${NO_BACKEND_URL}/workout/${id}`);
  await page.getByTestId('run-stage').waitFor();
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await playButton(page).click();
  await pauseButton(page).waitFor();
  await skipButton(page).click();
  await expect.poll(() => clipsPlayed(page)).toContain('seg-heavy-bag.m4a');
  await pauseButton(page).click();
  const before = await clipsPlayed(page);
  expect(before).not.toContain('num-2.m4a');
  await page.clock.runFor(1600);
  expect(await clipsPlayed(page)).toEqual(before);
  await playButton(page).click();
  await pauseButton(page).waitFor();
  await page.clock.runFor(1600);
  expect(await clipsPlayed(page)).toEqual(before);
});
