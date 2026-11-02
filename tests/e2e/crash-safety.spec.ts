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
  await playButton(page).click();
  await page.waitForURL("**/workout/**");
  await staleFile(page, /PunchCameraPanel.*\.js/);
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
  await page.goto(`${NO_BACKEND_URL}/quick-session`);
  await staleFile(page, /PunchCameraPanel.*\.js/);
  await playButton(page).click();
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
