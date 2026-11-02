// Firefox leaves the camera prompt open until someone answers it. Start must not wait on it forever.
import { expect, test } from "./silent";
import { silentLaunch } from "./silent";
import { playButton } from "./controls";
import { finishGuestOnboarding, NO_BACKEND_URL } from "./helpers";

test.use({ browserName: "firefox", launchOptions: silentLaunch.firefox });

test("in Firefox, an unanswered camera prompt doesn't keep you from starting", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 800 });
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
