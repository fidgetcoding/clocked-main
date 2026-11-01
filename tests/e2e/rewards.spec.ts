// The reward gate, measured in the database a real session writes to. The browser's clock is moved
// forward, so these run in seconds rather than minutes.
import { expect, test } from "./silent";
import { APP_URL, clickNewestEmailLink, finishAccountOnboarding, requestSignInEmail, service, trainAndFinish, userIdFor } from "./helpers";

const profileOf = async (userId: string) =>
  (await service.from("profiles").select("workouts_completed,total_training_seconds,current_streak,total_xp").eq("user_id", userId).single()).data;
const historyCount = async (userId: string) =>
  (await service.from("workout_history").select("*", { count: "exact", head: true }).eq("user_id", userId)).count;
const badgeCount = async (userId: string) =>
  (await service.from("badges").select("*", { count: "exact", head: true }).eq("user_id", userId)).count;

test("a 5-second workout earns nothing, and a real one earns its rewards", async ({ page }) => {
  // A new account has nothing saved yet, and that shouldn't show up as failed requests
  const refused: string[] = [];
  page.on("response", (response) => {
    const url = new URL(response.url());
    if (url.pathname.startsWith("/rest/v1/") && response.status() >= 400) refused.push(`${response.status()} ${url.pathname}`);
  });

  await page.clock.install();
  const email = `rewards-${Date.now()}@example.com`;
  await requestSignInEmail(page, APP_URL, email);
  await clickNewestEmailLink(page, email);
  await finishAccountOnboarding(page, "Reward Tester");
  const userId = await userIdFor(email);

  await test.step("5 seconds: no badges, no streak, no badge XP", async () => {
    await trainAndFinish(page, 5);
    await expect(page.getByText("Train for at least 5 minutes to earn badges and keep your streak going.")).toBeVisible();
    await expect(page.getByText(/Badge XP/)).toHaveCount(0);

    await page.getByRole("button", { name: "Log Workout" }).click();
    await expect.poll(() => historyCount(userId)).toBe(1);
    await expect.poll(async () => (await profileOf(userId))?.total_training_seconds).toBeGreaterThanOrEqual(5);
    const profile = await profileOf(userId);
    expect(profile?.workouts_completed).toBe(0);
    expect(profile?.current_streak).toBe(0);
    expect(await badgeCount(userId)).toBe(0);
    expect(profile?.total_xp).toBeLessThan(50);
  });

  await test.step("the 5-second session posted nothing to the feed", async () => {
    const { count } = await service.from("community_posts").select("*", { count: "exact", head: true }).eq("user_id", userId);
    expect(count).toBe(0);
  });

  await test.step("6 minutes: the streak starts and rewards land", async () => {
    await page.goto(`${APP_URL}/`);
    await trainAndFinish(page, 6 * 60);
    await expect(page.getByText("Train for at least 5 minutes")).toHaveCount(0);

    await page.getByRole("button", { name: "Log Workout" }).click();
    await expect.poll(() => historyCount(userId)).toBe(2);
    await expect.poll(async () => (await profileOf(userId))?.workouts_completed).toBe(1);
    await expect.poll(async () => (await profileOf(userId))?.current_streak).toBe(1);
    expect((await profileOf(userId))?.total_training_seconds).toBeGreaterThanOrEqual(6 * 60);
    await expect.poll(() => badgeCount(userId)).toBeGreaterThan(0);

    const badgeArt = page.locator('img[src*="/art/badges/"]').first();
    await expect(badgeArt).toBeVisible();
    await expect.poll(() => badgeArt.evaluate((image) => (image as HTMLImageElement).naturalWidth)).toBeGreaterThan(0);
  });

  expect(refused).toEqual([]);
});
