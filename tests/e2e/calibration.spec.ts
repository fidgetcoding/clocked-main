// Calibration before a camera session, with a made-up body fed through the real tracker. The camera is a canvas,
// and the body throws whichever punch the screen asks for, so this proves the flow, not how well real people are read.
import type { Page } from "@playwright/test";
import { simulate, type SynthPunch } from "../../src/test/punchSynth";
import { expect, spokenWords, test } from "./silent";
import { playButton } from "./controls";
import { finishGuestOnboarding, NO_BACKEND_URL } from "./helpers";

declare global {
  interface Window {
    __e2ePoseFeed?: (timestampMs: number) => { image: unknown; world: unknown };
  }
}

const SHAPES: Record<string, Pick<SynthPunch, "hand" | "shape">> = {
  jab: { hand: "lead", shape: "straight" },
  cross: { hand: "rear", shape: "straight" },
  lead_hook: { hand: "lead", shape: "hook" },
  rear_hook: { hand: "rear", shape: "hook" },
  lead_uppercut: { hand: "lead", shape: "uppercut" },
  rear_uppercut: { hand: "rear", shape: "uppercut" },
};

/** `swap` throws a different punch for the one asked, to see a miss handled. */
const fakeBody = async (page: Page, swap: Record<string, string> = {}) => {
  const throws = Object.fromEntries(
    Object.entries(SHAPES).map(([punch, shape]) => [punch, simulate({ startMs: 0, durationMs: 1500, punches: [{ ...shape, at: 200 }] }).map((frame) => frame.landmarks)]),
  );
  const guard = simulate({ startMs: 0, durationMs: 0 })[0].landmarks;
  await page.context().addInitScript(
    ({ throws, guard, swap }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const context = canvas.getContext("2d") as CanvasRenderingContext2D;
      let tick = 0;
      setInterval(() => {
        context.fillStyle = `rgb(${tick++ % 255}, 120, 120)`;
        context.fillRect(0, 0, 640, 480);
      }, 33);
      Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => canvas.captureStream(30) } });

      type Point = { x: number; y: number; z: number; visibility?: number };
      // The body's own metres, placed in the middle of the picture at a good distance
      const toImage = (points: Point[]) => points.map((p) => ({ x: 0.5 + p.x * 0.5, y: 0.5 + p.y * 0.5, z: p.z, visibility: p.visibility ?? 1 }));
      let playing: Point[][] | null = null;
      let startedAt = 0;
      let asked = "";
      window.__e2ePoseFeed = (timestampMs: number) => {
        const punch = document.querySelector("[data-calibration-punch]")?.getAttribute("data-calibration-punch") ?? "";
        const waiting = document.querySelector('[data-testid="calibration-step-line"]')?.textContent?.startsWith("Throw") ?? false;
        const prompt = waiting ? punch : "";
        // A new prompt gets its punch, and one still up after a few seconds gets it again, like a person would
        if (prompt && (prompt !== asked || (!playing && timestampMs - startedAt > 3000))) {
          playing = (throws as Record<string, Point[][]>)[(swap as Record<string, string>)[prompt] ?? prompt];
          startedAt = timestampMs;
        }
        asked = prompt;
        let world = guard as Point[];
        if (playing) {
          const frame = Math.floor((timestampMs - startedAt) / (1000 / 30));
          if (frame < playing.length) world = playing[frame];
          else playing = null;
        }
        return { image: toImage(world), world };
      };
    },
    { throws, guard, swap },
  );
};

const noSidewaysScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

const calibrate = async (page: Page) => {
  const calibration = page.getByTestId("calibration");
  await expect(calibration).toHaveAttribute("data-phase", "choose", { timeout: 30_000 });
  await noSidewaysScroll(page);
  await calibration.getByRole("button", { name: "Calibrate" }).click();
  // Framing passes by itself with a body in the picture, then the guard hold counts down
  await expect(calibration).toHaveAttribute("data-phase", "guard", { timeout: 10_000 });
  await expect(calibration).toHaveAttribute("data-phase", "punches", { timeout: 10_000 });
  return calibration;
};

for (const viewport of [{ width: 390, height: 844 }, { width: 1366, height: 768 }]) {
  test(`a Quick Session calibrates every punch, then starts at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await fakeBody(page);
    await finishGuestOnboarding(page, NO_BACKEND_URL, "Calibrator");
    await page.goto(`${NO_BACKEND_URL}/quick-session`);
    const calibration = await calibrate(page);

    await expect(calibration).toHaveAttribute("data-phase", "result", { timeout: 60_000 });
    await expect(calibration.getByText("Saw 6 of 6 punches.")).toBeVisible();
    await expect(page.getByTestId("calibration-expect")).toHaveText(/^From here: /);
    await expect(calibration.locator('[data-status="seen"]')).toHaveCount(6);
    await noSidewaysScroll(page);
    const spoken = await spokenWords(page);
    expect(spoken).toEqual(expect.arrayContaining(["Hands up. Hold still.", "Throw a jab", "Got it", "Throw a rear uppercut", "Calibration done."]));

    await calibration.getByRole("button", { name: "Start session" }).click();
    await expect(page.getByTestId("calibration")).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
    // The punches thrown for calibration aren't in the session
    await expect(page.getByTestId("log-live-total")).toHaveText("0");
  });
}

test("a punch read as something else gets a tip, and can be retried or skipped", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fakeBody(page, { jab: "lead_hook" });
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Retrier");
  await page.goto(`${NO_BACKEND_URL}/quick-session`);
  const calibration = await calibrate(page);

  await expect(page.getByTestId("calibration-step-line")).toHaveText("Looked like a lead hook.", { timeout: 10_000 });
  await expect(page.getByTestId("calibration-tip")).not.toBeEmpty();
  await calibration.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByTestId("calibration-step-line")).toHaveText(/^(Throw a jab\.|Looked like a lead hook\.)$/);
  await calibration.getByRole("button", { name: "Skip punch" }).click();
  await expect(page.getByTestId("calibration-prompt")).toHaveText("2 Cross");
  await calibration.getByRole("button", { name: "Skip calibration" }).click();
  await expect(page.getByTestId("calibration")).toHaveCount(0);
  await expect(playButton(page)).toBeEnabled();
});

test("Punch Check calibrates before the round, and its clock waits", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await fakeBody(page);
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Check Calibrator");
  await page.goto(`${NO_BACKEND_URL}/punch-check`);
  await page.getByRole("button", { name: /start|go/i }).first().click();
  const calibration = page.getByTestId("calibration");
  await expect(calibration).toHaveAttribute("data-phase", "choose", { timeout: 30_000 });
  const clock = page.getByTestId("punch-clock");
  const before = await clock.textContent();
  await page.waitForTimeout(2000);
  expect(await clock.textContent()).toBe(before);

  await calibrate(page);
  await expect(calibration).toHaveAttribute("data-phase", "result", { timeout: 60_000 });
  await calibration.getByRole("button", { name: "Start round" }).click();
  await expect(calibration).toHaveCount(0);
  await expect.poll(async () => clock.textContent(), { timeout: 5000 }).not.toBe(before);
  await expect(page.getByTestId("punch-count")).toHaveText("0");
});

test("a workout opens on calibration too, and it can be skipped", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await fakeBody(page);
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Workout Calibrator");
  await page.evaluate(() =>
    localStorage.setItem("get-clocked-punch-prefs", JSON.stringify({ state: { roundSeconds: 0, voiceCues: false, quickSessionCamera: true, workoutCamera: true }, version: 0 })),
  );
  await page.goto(NO_BACKEND_URL);
  await playButton(page).click();
  await page.waitForURL("**/workout/**");
  await expect(page.getByTestId("calibration")).toHaveAttribute("data-phase", "choose", { timeout: 30_000 });
  await page.getByRole("button", { name: "Calibrate" }).click();
  await page.getByRole("button", { name: "Skip calibration" }).click();
  await expect(page.getByTestId("calibration")).toHaveCount(0);
  await playButton(page).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
});
