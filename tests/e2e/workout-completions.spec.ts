// A set's "Completed Nx" counts runs that were finished or saved, never one walked away from.
import type { Page } from "@playwright/test";
import { expect, test } from "./silent";
import { finishGuestOnboarding, NO_BACKEND_URL, startTraining } from "./helpers";

const timesCompleted = (page: Page, id: string) =>
  page.evaluate(
    (workoutId) =>
      (JSON.parse(localStorage.getItem("get-clocked-workouts") ?? "{}").state?.guestWorkouts ?? []).find((row: { id: string }) => row.id === workoutId)
        ?.times_completed ?? null,
    id,
  );

const startAndTrain = async (page: Page) => {
  await page.goto(NO_BACKEND_URL);
  await startTraining(page);
  await page.clock.fastForward(30_000);
  return new URL(page.url()).pathname.split("/").pop() as string;
};

const leave = async (page: Page, choice: string) => {
  await page.getByRole("button", { name: "Leave workout" }).click();
  await page.getByRole("button", { name: choice }).click();
  await page.waitForURL((url) => url.pathname === "/");
};

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Completions");
});

test("Leave Without Saving doesn't count the run, End & Save does", async ({ page }) => {
  const id = await startAndTrain(page);
  const before = await timesCompleted(page, id);
  expect(before).not.toBeNull();

  await leave(page, "Leave Without Saving");
  expect(await timesCompleted(page, id)).toBe(before);

  await startAndTrain(page);
  await leave(page, "End & Save");
  await expect.poll(() => timesCompleted(page, id)).toBe(before + 1);
});

test("finishing early counts only once it's logged", async ({ page }) => {
  const id = await startAndTrain(page);
  const before = await timesCompleted(page, id);

  await page.getByTitle("Complete workout early").click();
  await page.getByText("XP Breakdown").waitFor();
  expect(await timesCompleted(page, id)).toBe(before);

  await page.getByRole("button", { name: "Log Workout" }).click();
  await expect.poll(() => timesCompleted(page, id)).toBe(before + 1);
});

test("a hand-logged workout counts toward the Workouts total", async ({ page }) => {
  await page.goto(`${NO_BACKEND_URL}/history`);
  await page.getByRole("button", { name: "Log a Workout" }).click();
  await page.getByLabel("Workout Name").fill("Bag work");
  await page.getByRole("button", { name: "Log Workout" }).last().click();
  await expect(page.getByText("Workouts 1").first()).toBeAttached();
});
