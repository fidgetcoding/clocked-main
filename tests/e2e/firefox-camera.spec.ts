// Firefox leaves the camera prompt open until someone answers it. Start must not wait on it forever.
import { expect, test } from "./silent";
import { silentLaunch } from "./silent";
import { playButton } from "./controls";
import { finishGuestOnboarding, NO_BACKEND_URL } from "./helpers";

// Firefox's own fake camera, so there is a camera to ask for on a machine without one, and no real one is touched
test.use({
  browserName: "firefox",
  launchOptions: {
    ...silentLaunch.firefox,
    firefoxUserPrefs: { ...silentLaunch.firefox.firefoxUserPrefs, "media.navigator.streams.fake": true },
  },
});

test("in Firefox, an unanswered camera prompt doesn't keep you from starting", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
  expect(await page.evaluate(() => navigator.userAgent)).toContain("Firefox");
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Firefox");
  await page.evaluate(() =>
    localStorage.setItem("get-clocked-punch-prefs", JSON.stringify({ state: { roundSeconds: 0, voiceCues: false, quickSessionCamera: true, workoutCamera: true }, version: 0 })),
  );
  await page.goto(`${NO_BACKEND_URL}/quick-session`);
  await expect(page.getByRole("button", { name: "Train without camera" })).toBeVisible();
  await expect(playButton(page)).toBeEnabled({ timeout: 15_000 });
  await playButton(page).click();
  await expect(page.getByRole("button", { name: "Pause", exact: true })).toBeVisible();
});
