import type { Page } from "@playwright/test";

// The transport on a run screen, and the play button on a set, by the names people and screen readers get.
export const playButton = (page: Page) => page.getByRole("button", { name: /^(Play|Start( .+)?)$/ }).first();
export const pauseButton = (page: Page) => page.getByRole("button", { name: "Pause", exact: true });
export const skipButton = (page: Page) => page.getByRole("button", { name: "Skip segment" });
export const finishSessionButton = (page: Page) => page.getByRole("button", { name: "Finish session" });
export const elapsedClock = (page: Page) => page.getByTestId("run-elapsed");
