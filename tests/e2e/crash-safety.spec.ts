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

test("a camera prompt nobody answers stops holding start after a few seconds", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await withCamera(page, "() => new Promise(() => {})");
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Ignored");
  await cameraOn(page);
  await page.goto(`${NO_BACKEND_URL}/quick-session`);
  await expect(playButton(page)).toBeDisabled();
  await expect(playButton(page)).toBeEnabled({ timeout: 15_000 });
  await playButton(page).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
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
  // Calibration opens once the feed is live
  await expect(page.getByTestId("calibration")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByTestId("camera-panel").locator("video")).toBeVisible();
  await page.getByRole("button", { name: /^Leave/ }).first().click();
  await page.waitForURL((url) => url.pathname === "/");
  await expect.poll(() => page.evaluate(() => (window as unknown as { __stopped: number }).__stopped)).toBeGreaterThan(0);
});

test("a camera blocked in the browser's settings says blocked, whatever error it comes back with", async ({ page }) => {
  await withCamera(page, "async () => { throw new DOMException('Not supported', 'NotSupportedError'); }");
  await page.context().addInitScript(() => {
    Object.defineProperty(navigator, "permissions", { configurable: true, value: { query: async () => ({ state: "denied" }) } });
  });
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Blocked Settings");
  await cameraOn(page);
  await page.goto(`${NO_BACKEND_URL}/quick-session`);
  await expect(page.getByText("Camera access is blocked")).toBeVisible();
});

test("while the camera is still asking, you can still leave", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await withCamera(page, "() => new Promise(() => {})");
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Stuck");
  await cameraOn(page);
  await page.goto(`${NO_BACKEND_URL}/quick-session`);
  await expect(page.getByText("Allow your camera")).toBeVisible();
  await page.getByRole("button", { name: /^Leave/ }).first().click();
  await page.waitForURL((url) => url.pathname === "/");
});

for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1280, height: 720 }]) {
  test(`calibration coaches the setup in its own words and keeps Leave in reach at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await withCamera(page, fakeStream);
    await finishGuestOnboarding(page, NO_BACKEND_URL, "Setup");
    await cameraOn(page);
    await page.goto(`${NO_BACKEND_URL}/quick-session`);
    const calibration = page.getByTestId("calibration");
    await expect(calibration).toHaveAttribute("data-phase", "choose", { timeout: 30_000 });
    await expect(calibration.getByRole("button", { name: "Calibrate" })).toBeInViewport();
    await expect(calibration.getByRole("button", { name: "Skip calibration" })).toBeInViewport();
    await calibration.getByRole("button", { name: "Calibrate" }).click();

    // A blank picture: setup says what's wrong, and holds there rather than moving on
    await expect(page.getByTestId("calibration-framing")).toHaveText(/^(Can't see anyone|Too dark)/, { timeout: 10_000 });
    await expect(calibration).toHaveAttribute("data-phase", "setup");
    await expect(page.getByTestId("camera-panel-warning")).toHaveCount(0);
    await expect(calibration.getByText(/Don't put the phone behind the bag/)).toBeAttached();

    const leave = page.getByRole("button", { name: /^Leave/ }).first();
    await expect(leave).toBeInViewport();
    const covered = await leave.evaluate((el) => {
      const box = el.getBoundingClientRect();
      return !!document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)?.closest('[data-testid="calibration"]');
    });
    expect(covered).toBe(false);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);

    await calibration.getByRole("button", { name: "Skip calibration" }).click();
    await expect(calibration).toHaveCount(0);
    await expect(page.getByTestId("camera-panel-warning")).toBeVisible({ timeout: 10_000 });
  });
}

test("a device with no camera says so plainly and starts without it", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.context().addInitScript(() => {
    (window as unknown as { __asked: number }).__asked = 0;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        enumerateDevices: async () => [{ kind: "audioinput", deviceId: "", groupId: "", label: "" }],
        getUserMedia: async () => {
          (window as unknown as { __asked: number }).__asked++;
          throw new DOMException("none", "NotFoundError");
        },
      },
    });
  });
  await finishGuestOnboarding(page, NO_BACKEND_URL, "No Camera");
  await cameraOn(page);
  await page.goto(`${NO_BACKEND_URL}/quick-session`);
  await expect(page.getByText("No camera found")).toBeVisible();
  await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
  expect(await page.evaluate(() => (window as unknown as { __asked: number }).__asked)).toBe(0);
  await playButton(page).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
});

test("a camera error nobody can name says Camera unavailable, offers Try again, and start works", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  await withCamera(page, "async () => { throw new DOMException('odd', 'SomethingNewError'); }");
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Odd Camera");
  await cameraOn(page);
  await page.goto(`${NO_BACKEND_URL}/quick-session`);
  await expect(page.getByText("Camera unavailable")).toBeVisible();
  await expect(page.getByText(/something went wrong/i)).toHaveCount(0);
  await page.getByRole("button", { name: "Try again" }).click();
  await expect(page.getByText("Camera unavailable")).toBeVisible();
  await playButton(page).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
});
