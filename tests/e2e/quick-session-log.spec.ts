// With the camera on, a Quick Session logs every punch: live, in the summary, and in history.
// There is no real camera or person here. The camera is a blank canvas and the pose model is fed
// synthetic poses through the real detector, so this proves the logging, not how well the detector
// reads real people.
import type { Page } from "@playwright/test";
import { simulate, type SynthPunch } from "../../src/test/punchSynth";
import { expect, test } from "./silent";
import {
  APP_URL,
  clickNewestEmailLink,
  finishAccountOnboarding,
  finishGuestOnboarding,
  NO_BACKEND_URL,
  requestSignInEmail,
  service,
  userIdFor,
} from "./helpers";

declare global {
  interface Window {
    __e2ePoseFeed?: (timestampMs: number) => { image: unknown; world: unknown };
  }
}

const PUNCHES: SynthPunch[] = [
  { hand: "lead", shape: "straight", at: 1500 },
  { hand: "rear", shape: "straight", at: 2100 },
  { hand: "lead", shape: "hook", at: 2800, otherHandDrops: true },
  { hand: "rear", shape: "straight", at: 6000 },
];
const DURATION_MS = 8000;

const fakeCameraAndPoses = async (page: Page) => {
  const frames = simulate({ durationMs: DURATION_MS, fps: 30, punches: PUNCHES });
  await page.context().addInitScript((recorded) => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 48;
    const context = canvas.getContext("2d") as CanvasRenderingContext2D;
    let tick = 0;
    setInterval(() => {
      context.fillStyle = `rgb(${tick++ % 255}, 90, 90)`;
      context.fillRect(0, 0, 64, 48);
    }, 33);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => canvas.captureStream(30) },
    });
    let first: number | null = null;
    window.__e2ePoseFeed = (timestampMs: number) => {
      first ??= timestampMs;
      const at = timestampMs - first;
      const frame = recorded.find((candidate) => candidate.t >= at) ?? recorded[recorded.length - 1];
      return { image: frame.landmarks, world: frame.landmarks };
    };
  }, frames);
};

const openQuickSession = async (page: Page, base: string) => {
  await page.goto(`${base}/quick-session`);
  await page.getByText("QUICK SESSION").waitFor();
  const camera = page.getByRole("switch", { name: "Punch camera" });
  if ((await camera.getAttribute("data-state")) !== "checked") await camera.click();
};

const trainAndFinish = async (page: Page) => {
  await page.locator("button:has(svg.lucide-play)").first().click();
  await expect(page.getByTestId("log-live-total")).toHaveText(String(PUNCHES.length), { timeout: 20_000 });
  const lead = Number(await page.getByTestId("log-live-lead").textContent());
  const rear = Number(await page.getByTestId("log-live-rear").textContent());
  expect(lead + rear).toBe(PUNCHES.length);
  await page.locator("button:has(svg.lucide-square)").click();
  await page.getByText("SESSION COMPLETE!").waitFor();
};

const expectSummary = async (page: Page) => {
  await expect(page.getByTestId("log-total")).toHaveText(String(PUNCHES.length));
  await expect(page.getByTestId("log-rounds")).toHaveText("1");
  await expect(page.getByTestId("log-combos")).toHaveText("1");
};

for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`a guest's punches are logged and kept in this browser at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await fakeCameraAndPoses(page);
    await finishGuestOnboarding(page, NO_BACKEND_URL, "Log Guest");
    await openQuickSession(page, NO_BACKEND_URL);
    await page.locator("button:has(svg.lucide-play)").first().click();

    await expect(page.getByTestId("log-live-total")).toHaveText(String(PUNCHES.length), { timeout: 20_000 });

    // Everything needed mid-session stays on screen and clear of the camera
    const finish = page.locator("button:has(svg.lucide-square)");
    await expect(finish).toBeInViewport();
    const panel = (await page.getByTestId("camera-panel").boundingBox())!;
    const timer = (await page.locator(".timer-display").boundingBox())!;
    expect(panel.y + panel.height <= timer.y || panel.x + panel.width <= timer.x).toBe(true);

    if (process.env.STACK_SHOTS) await page.screenshot({ path: `${process.env.STACK_SHOTS}/live-${viewport.width}.png`, fullPage: true });
    await finish.click();
    await page.getByText("SESSION COMPLETE!").waitFor();
    await expectSummary(page);
    if (process.env.STACK_SHOTS) await page.screenshot({ path: `${process.env.STACK_SHOTS}/summary-${viewport.width}.png`, fullPage: true });
    await page.getByRole("button", { name: /log/i }).first().click();

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("get-clocked-history") as string).state.guestHistory[0]);
    expect(saved.punch_log.punches).toHaveLength(PUNCHES.length);
    expect(saved.punch_log.punches[0]).toMatchObject({ hand: "lead", round: 1 });

    await page.goto(`${NO_BACKEND_URL}/history`);
    await page.getByText("Quick Session").first().click();
    await expect(page.getByTestId("log-total")).toHaveText(String(PUNCHES.length));
  });
}

test("a reload mid-session keeps the punches already logged", async ({ page }) => {
  await fakeCameraAndPoses(page);
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Log Reload");
  await openQuickSession(page, NO_BACKEND_URL);
  await page.locator("button:has(svg.lucide-play)").first().click();
  await expect(page.getByTestId("log-live-total")).toHaveText(String(PUNCHES.length), { timeout: 20_000 });
  // The save happens on the second's tick
  await page.waitForTimeout(1500);

  await page.reload();
  await page.getByRole("button", { name: /resume/i }).click();
  await expect(page.getByTestId("log-live-total")).toHaveText(String(PUNCHES.length));
  await page.locator("button:has(svg.lucide-play)").first().click();
  await page.locator("button:has(svg.lucide-square)").click();
  await page.getByText("SESSION COMPLETE!").waitFor();
  await expect(page.getByTestId("log-total")).toHaveText(String(PUNCHES.length));
  await expect(page.getByTestId("log-rounds")).toHaveText("2");
});

test("a camera that never starts logs nothing, and the session still works", async ({ page }) => {
  await page.context().addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => Promise.reject(new DOMException("no", "NotAllowedError")) },
    });
  });
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Log Denied");
  await openQuickSession(page, NO_BACKEND_URL);
  await page.locator("button:has(svg.lucide-play)").first().click();
  await page.getByTestId("camera-panel-problem").waitFor();
  await page.locator("button:has(svg.lucide-square)").click();
  await page.getByText("SESSION COMPLETE!").waitFor();
  await expect(page.getByTestId("punch-log")).toHaveCount(0);
});

test("an account's punches go in the database and come back in history", async ({ page }) => {
  await fakeCameraAndPoses(page);
  const email = `punch-log-${Date.now()}@example.com`;
  await requestSignInEmail(page, APP_URL, email);
  await clickNewestEmailLink(page, email);
  await finishAccountOnboarding(page, "Log Account");
  await openQuickSession(page, APP_URL);
  await trainAndFinish(page);
  await expectSummary(page);
  await page.getByRole("button", { name: /log/i }).first().click();

  const userId = await userIdFor(email);
  await expect
    .poll(async () => {
      const { data } = await service.from("workout_history").select("punch_log").eq("user_id", userId);
      return data?.[0]?.punch_log?.punches?.length;
    })
    .toBe(PUNCHES.length);

  await page.goto(`${APP_URL}/history`);
  await page.getByText("Quick Session").first().click();
  await expect(page.getByTestId("log-total")).toHaveText(String(PUNCHES.length));
});
