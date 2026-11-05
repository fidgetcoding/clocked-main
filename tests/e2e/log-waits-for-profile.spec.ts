// "Workout Logged!" means the streak and totals are saved too, not just the history row.
import type { Page, Route } from "@playwright/test";
import { expect, test } from "./silent";
import { APP_URL, clickNewestEmailLink, finishAccountOnboarding, requestSignInEmail, service, trainAndFinish, userIdFor } from "./helpers";

// A logged session's streak and totals are saved by one database function, credited once per history row
const PROFILE_CREDIT = "**/rest/v1/rpc/credit_session_to_profile**";
const profileSaves = (page: Page, handle: (route: Route) => Promise<void>) => page.route(PROFILE_CREDIT, handle);

const signIn = async (page: Page, label: string) => {
  const email = `${label}-${Date.now()}@example.com`;
  await requestSignInEmail(page, APP_URL, email);
  await clickNewestEmailLink(page, email);
  await finishAccountOnboarding(page, "Streak Keeper");
  return userIdFor(email);
};

const historyRows = async (userId: string) => (await service.from("workout_history").select("id").eq("user_id", userId)).data?.length ?? 0;
const streak = async (userId: string) => (await service.from("profiles").select("current_streak").eq("user_id", userId).single()).data?.current_streak ?? 0;
// A new account's XP is exactly what its one logged session earned, reload or not, so paying twice (or
// dropping the badge XP a reload no longer counts as new) shows up here
const creditedOnce = async (userId: string) => {
  const [{ data: profile }, { data: history }] = await Promise.all([
    service.from("profiles").select("total_xp").eq("user_id", userId).single(),
    service.from("workout_history").select("xp_earned").eq("user_id", userId),
  ]);
  const earned = history?.[0]?.xp_earned ?? 0;
  return earned > 0 && profile?.total_xp === earned;
};

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

  await page.unroute(PROFILE_CREDIT);
  await page.getByRole("button", { name: "Log Workout" }).click();
  await expect(page.getByText("Workout Logged!")).toBeVisible();
  expect(await historyRows(userId)).toBe(1);
  await expect.poll(() => streak(userId)).toBeGreaterThan(0);
  expect(await creditedOnce(userId)).toBe(true);
});

test("a reload between a failed streak save and the retry still logs the workout once", async ({ page }) => {
  await page.clock.install();
  const userId = await signIn(page, "streak-reload");
  await page.goto(APP_URL);
  await trainAndFinish(page, 360);

  await profileSaves(page, (route) => route.fulfill({ status: 500, contentType: "application/json", body: '{"message":"down"}' }));
  await page.getByRole("button", { name: "Log Workout" }).click();
  await expect(page.getByText("Couldn't save your workout", { exact: false })).toBeVisible();
  await expect.poll(() => historyRows(userId)).toBe(1);

  await page.unroute(PROFILE_CREDIT);
  await page.reload();
  await page.getByRole("button", { name: "Resume" }).click();
  await page.getByRole("button", { name: "Log Workout" }).click();
  await expect(page.getByText("Workout Logged!")).toBeVisible();
  expect(await historyRows(userId)).toBe(1);
  await expect.poll(() => streak(userId)).toBeGreaterThan(0);
  expect(await creditedOnce(userId)).toBe(true);
});
