import type { Page } from "@playwright/test";

// The transport on a run screen, and the play button on a set, by the names people and screen readers get.
export const playButton = (page: Page) => page.getByRole("button", { name: /^(Play|Start( .+)?)$/ }).first();
export const pauseButton = (page: Page) => page.getByRole("button", { name: "Pause", exact: true });
export const skipButton = (page: Page) => page.getByRole("button", { name: "Skip segment" });
export const finishSessionButton = (page: Page) => page.getByRole("button", { name: "Finish session" });
export const elapsedClock = (page: Page) => page.getByTestId("run-elapsed");

/** Calibration opens over the stage once the camera is live. Specs that aren't about it skip it. */
export const skipCalibration = async (page: Page) => {
  await page.getByRole("button", { name: "Skip calibration" }).click({ timeout: 20_000 });
  await page.getByTestId("calibration").waitFor({ state: "detached" });
};
