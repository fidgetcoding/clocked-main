// The Free Side panel on the camera screens, fed made-up bodies through the real tracker path. The camera is a canvas.
import type { Page } from "@playwright/test";
import { expect, test } from "./silent";
import { playButton } from "./controls";
import { finishGuestOnboarding, NO_BACKEND_URL } from "./helpers";

declare global {
  interface Window {
    __e2eBody?: number[][];
    __e2ePoseFeed?: (timestampMs: number) => { image: unknown; world: unknown };
  }
}

// x, y and visibility in the unmirrored picture, for the landmarks the model is sure of
const body = (left: number, right: number, top = 0.1, bottom = 0.9) => [
  [left, top],
  [right, top],
  [(left + right) / 2, (top + bottom) / 2],
  [left, bottom],
  [right, bottom],
];

const fakeCamera = async (page: Page, start: number[][]) => {
  await page.context().addInitScript((first) => {
    const canvas = document.createElement("canvas");
    canvas.width = 640;
    canvas.height = 480;
    const context = canvas.getContext("2d") as CanvasRenderingContext2D;
    setInterval(() => context.fillRect(0, 0, 640, 480), 33);
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => canvas.captureStream(30) } });
    window.__e2eBody = first;
    window.__e2ePoseFeed = () => {
      const seen = (window.__e2eBody as number[][]).map(([x, y]) => ({ x, y, z: 0, visibility: 1 }));
      const landmarks = Array.from({ length: 33 }, (_, index) => seen[index] ?? { x: 0.5, y: 0.5, z: 0, visibility: 0 });
      return { image: landmarks, world: landmarks };
    };
  }, start);
};

const startSession = async (page: Page) => {
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Free Side");
  await page.goto(`${NO_BACKEND_URL}/quick-session`);
  const camera = page.getByRole("switch", { name: "Punch camera" });
  if ((await camera.getAttribute("data-state")) !== "checked") await camera.click();
  await playButton(page).click();
  await expect(page.getByTestId("free-panel")).toBeVisible({ timeout: 20_000 });
};

const setBody = (page: Page, points: number[][]) => page.evaluate((next) => (window.__e2eBody = next), points);

test("the panel jumps to the emptier side, folds when you come close, and unfolds again", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  // On the left of the picture is on the right of the mirrored screen
  await fakeCamera(page, body(0.05, 0.3));
  await startSession(page);
  const panel = page.getByTestId("free-panel");
  await expect(panel).toHaveAttribute("data-side", "left", { timeout: 10_000 });
  await expect(panel).toHaveAttribute("data-mode", "side");

  await setBody(page, body(0.7, 0.95));
  await expect(panel).toHaveAttribute("data-side", "right", { timeout: 10_000 });

  await setBody(page, body(0.1, 0.9, 0.5, 0.95));
  await expect(panel).toHaveAttribute("data-mode", "strip", { timeout: 10_000 });
  await expect(panel).toHaveAttribute("data-edge", "top");

  await setBody(page, body(0.05, 0.3));
  await expect(panel).toHaveAttribute("data-mode", "side", { timeout: 10_000 });
});

test("on an upright phone it stays a strip and moves above or below the body", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await fakeCamera(page, body(0.3, 0.7, 0.05, 0.35));
  await startSession(page);
  const panel = page.getByTestId("free-panel");
  await expect(panel).toHaveAttribute("data-mode", "strip");
  await expect(panel).toHaveAttribute("data-edge", "bottom", { timeout: 10_000 });
  await setBody(page, body(0.3, 0.7, 0.55, 0.85));
  await expect(panel).toHaveAttribute("data-edge", "top", { timeout: 10_000 });
});

test("the numbers are lit readouts and the light says what you're doing", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await fakeCamera(page, body(0.05, 0.3));
  await startSession(page);
  await expect(page.getByTestId("run-clock").locator("svg polygon.lit-on").first()).toBeVisible();
  await expect(page.getByTestId("run-stage").getByText("Grind", { exact: true })).toBeVisible();
  await expect(page.getByText("On air")).toHaveCount(0);
  await page.getByRole("button", { name: "Pause", exact: true }).click();
  await expect(page.getByTestId("run-stage").getByText("Paused", { exact: true })).toBeVisible();
});

test("Punch Check uses the same panel, and the end button stays clear", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await fakeCamera(page, body(0.05, 0.3));
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Free Check");
  await page.goto(`${NO_BACKEND_URL}/punch-check`);
  await page.getByRole("button", { name: /start|go/i }).first().click();
  const panel = page.getByTestId("free-panel");
  await expect(panel).toHaveAttribute("data-side", "left", { timeout: 20_000 });
  await setBody(page, body(0.7, 0.95));
  await expect(panel).toHaveAttribute("data-side", "right", { timeout: 10_000 });
  await expect(page.getByTestId("punch-clock").locator("svg")).toBeVisible();
  await expect(page.getByRole("button", { name: "End round" })).toBeInViewport();
  const ticker = await page.locator("[data-ticker]").boundingBox();
  expect((ticker?.y ?? 0) + (ticker?.height ?? 0)).toBeGreaterThan(780);
});

test("nobody sees on-air copy before a session", async ({ page }) => {
  await page.goto(`${NO_BACKEND_URL}/onboarding`);
  await page.getByRole("button", { name: "GET STARTED" }).waitFor();
  await expect(page.getByText(/on air|stand by|tonight, live/i)).toHaveCount(0);
  await expect(page.locator("[data-ticker]")).toHaveCount(0);
  await finishGuestOnboarding(page, NO_BACKEND_URL, "No Filler");
  await expect(page.getByText(/on air/i)).toHaveCount(0);
});
