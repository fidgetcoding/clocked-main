// A blank page is the worst thing the app can show. These break loading on purpose, the way a new deploy does mid-visit.
import { expect, test } from "./silent";
import { playButton } from "./controls";
import { finishGuestOnboarding, NO_BACKEND_URL } from "./helpers";

const staleFile = (page: import("@playwright/test").Page, name: RegExp) =>
  page.route(name, (route) => route.fulfill({ status: 200, contentType: "text/html", body: "<!doctype html><html></html>" }));

const cameraOn = (page: import("@playwright/test").Page) =>
  page.evaluate(() =>
    localStorage.setItem("get-clocked-punch-prefs", JSON.stringify({ state: { roundSeconds: 0, voiceCues: false, quickSessionCamera: true, workoutCamera: true }, version: 0 })),
  );

test("a workout carries on when the camera's code can't load", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Stale Workout");
  await cameraOn(page);
  await page.goto(NO_BACKEND_URL);
  await staleFile(page, /PunchCameraPanel.*\.js/);
  await playButton(page).click();
  await page.waitForURL("**/workout/**");
  await playButton(page).click();
  await expect(page.getByText("The camera couldn't load", { exact: false })).toBeVisible();
  await expect(page.getByTestId("run-stage")).toHaveAttribute("data-camera", "off");
  await expect(page.getByTestId("run-clock")).toBeVisible();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
});

test("a Quick Session carries on when the camera's code can't load", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Stale Quick");
  await cameraOn(page);
  await staleFile(page, /PunchCameraPanel.*\.js/);
  await page.goto(`${NO_BACKEND_URL}/quick-session`);
  await expect(page.getByText("The camera couldn't load", { exact: false })).toBeVisible();
  await expect(page.getByTestId("run-clock")).toBeVisible();
});

test("a page that can't load says so and offers a way out, never a blank screen", async ({ page }) => {
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Stale Page");
  await staleFile(page, /PunchCheck.*\.js/);
  await page.goto(`${NO_BACKEND_URL}/punch-check`);
  await expect(page.getByTestId("app-error")).toBeVisible();
  await page.unroute(/PunchCheck.*\.js/);
  await page.getByRole("button", { name: "Go home" }).click();
  await page.getByText("Your Sets").waitFor();
});

const withCamera = (page: import("@playwright/test").Page, getUserMedia: string) =>
  page.context().addInitScript((source) => {
    (window as unknown as { __stopped: number }).__stopped = 0;
    const make = new Function(`return ${source}`)() as () => Promise<MediaStream>;
    Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: make } });
  }, getUserMedia);

const fakeStream = `async () => {
  const canvas = document.createElement("canvas");
  canvas.width = 64; canvas.height = 48;
  setInterval(() => canvas.getContext("2d").fillRect(0, 0, 64, 48), 33);
  const stream = canvas.captureStream(30);
  stream.getTracks().forEach((track) => {
    const stop = track.stop.bind(track);
    track.stop = () => { window.__stopped++; stop(); };
  });
  return stream;
}`;

test("the camera is asked for on arrival, and start waits until it answers", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await withCamera(page, "() => new Promise(() => {})");
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Asking");
  await cameraOn(page);
  await page.goto(`${NO_BACKEND_URL}/quick-session`);
  await expect(page.getByText("Allow your camera")).toBeVisible();
  await expect(playButton(page)).toBeDisabled();
  await page.getByRole("button", { name: "Train without camera" }).click();
  await expect(playButton(page)).toBeEnabled();
});

test("a blocked camera says so before start, and you can still train", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await withCamera(page, "async () => { throw new DOMException('no', 'NotAllowedError'); }");
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Blocked");
  await cameraOn(page);
  await page.goto(`${NO_BACKEND_URL}/quick-session`);
  await expect(page.getByTestId("camera-panel-problem")).toBeVisible();
  await playButton(page).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
});

test("the feed shows before start, and leaving turns the camera off", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await withCamera(page, fakeStream);
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Leaver");
  await cameraOn(page);
  await page.goto(`${NO_BACKEND_URL}/quick-session`);
  await expect(page.getByTestId("run-stage")).toHaveAttribute("data-camera", "on");
  await expect(playButton(page)).toBeEnabled({ timeout: 30_000 });
  await expect(page.getByTestId("camera-panel").locator("video")).toBeVisible();
  await page.getByRole("button", { name: /^Leave/ }).first().click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect.poll(() => page.evaluate(() => (window as unknown as { __stopped: number }).__stopped)).toBeGreaterThan(0);
});
