// "Workout Logged!" means the streak and totals are saved too, not just the history row.
import type { Page, Route } from "@playwright/test";
import { expect, test } from "./silent";
import { APP_URL, clickNewestEmailLink, finishAccountOnboarding, requestSignInEmail, service, trainAndFinish, userIdFor } from "./helpers";

const profileSaves = (page: Page, handle: (route: Route) => Promise<void>) =>
  page.route("**/rest/v1/profiles**", (route) => (route.request().method() === "PATCH" ? handle(route) : route.continue()));

const signIn = async (page: Page, label: string) => {
  const email = `${label}-${Date.now()}@example.com`;
  await requestSignInEmail(page, APP_URL, email);
  await clickNewestEmailLink(page, email);
  await finishAccountOnboarding(page, "Streak Keeper");
  return userIdFor(email);
};

const historyRows = async (userId: string) => (await service.from("workout_history").select("id").eq("user_id", userId)).data?.length ?? 0;
const streak = async (userId: string) => (await service.from("profiles").select("current_streak").eq("user_id", userId).single()).data?.current_streak ?? 0;

test("Workout Logged! waits for the streak to save", async ({ page }) => {
  await page.clock.install();
  const userId = await signIn(page, "streak-wait");
  await page.goto(APP_URL);
  await trainAndFinish(page, 360);

  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  await profileSaves(page, async (route) => {
    await held;
    await route.continue();
  });
  await page.getByRole("button", { name: "Log Workout" }).click();
  await expect.poll(() => historyRows(userId)).toBe(1);
  await page.waitForTimeout(500);
  await expect(page.getByText("Workout Logged!")).toHaveCount(0);
  release();
  await expect(page.getByText("Workout Logged!")).toBeVisible();
  await expect.poll(() => streak(userId)).toBeGreaterThan(0);
});

test("a streak save that fails says so, keeps the run, and a retry doesn't log it twice", async ({ page }) => {
  await page.clock.install();
  const userId = await signIn(page, "streak-fail");
  await page.goto(APP_URL);
  await trainAndFinish(page, 360);

  await profileSaves(page, (route) => route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"down"}' }));
  await page.getByRole("button", { name: "Log Workout" }).click();
  await expect(page.getByText("Couldn't save your workout", { exact: false })).toBeVisible();
  await expect(page.getByText("Workout Logged!")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("get-clocked-session"))).not.toBeNull();

  await page.unroute("**/rest/v1/profiles**");
  await page.getByRole("button", { name: "Log Workout" }).click();
  await expect(page.getByText("Workout Logged!")).toBeVisible();
  expect(await historyRows(userId)).toBe(1);
  await expect.poll(() => streak(userId)).toBeGreaterThan(0);
});
