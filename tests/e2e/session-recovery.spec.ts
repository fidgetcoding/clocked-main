// A reload or a killed tab must not lose a workout, or pay for it twice.
import type { Page } from "@playwright/test";
import { expect, test } from "./silent";
import { finishGuestOnboarding, NO_BACKEND_URL } from "./helpers";
import { playButton, pauseButton, skipButton, finishSessionButton, elapsedClock } from "./controls";

const prompt = (page: Page) => page.getByText("Pick up where you left off?");
const storedXP = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("get-clocked-user") as string).state.guestProfile?.total_xp ?? 0);
const savedSession = (page: Page) => page.evaluate(() => localStorage.getItem("get-clocked-session"));
const earnedXP = async (page: Page) =>
  Number((await page.getByText(/^\+\d+$/).first().textContent())?.replace("+", ""));
const badgesEarned = async (page: Page) => {
  const heading = page.getByText(/^Badges Earned \(\d+\)$/i);
  return (await heading.count()) ? await heading.textContent() : "none";
};

const startFirstSet = async (page: Page) => {
  await playButton(page).click();
  await page.waitForURL("**/workout/**");
  await playButton(page).click();
  await pauseButton(page).waitFor();
};

const train = async (page: Page, seconds: number) => {
  await skipButton(page).click();
  await page.clock.fastForward(seconds * 1000);
  // The live badge check runs on its own timer
  await page.clock.runFor(6000);
};

const finishAndLog = async (page: Page) => {
  await page.getByTitle("Complete workout early").click();
  await page.getByText("XP Breakdown").waitFor();
  const result = { xp: await earnedXP(page), badges: await badgesEarned(page) };
  await page.getByRole("button", { name: "Log Workout" }).click();
  await page.getByText("Workout Logged!").waitFor();
  return result;
};

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Recovery");
});

test("a reload offers to resume, and resuming comes back paused where it was", async ({ page }) => {
  await startFirstSet(page);
  await train(page, 90);
  const before = await elapsedClock(page).textContent();
  await page.reload();

  await expect(prompt(page)).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await expect(prompt(page)).toHaveCount(0);
  await expect(elapsedClock(page)).toHaveText(before as string);
  await expect(playButton(page)).toBeVisible();
  await expect(page.getByText("PREPARATION")).toHaveCount(0);

  await playButton(page).click();
  await pauseButton(page).waitFor();
});

test("discarding starts clean and doesn't ask again", async ({ page }) => {
  await startFirstSet(page);
  await train(page, 30);
  await page.reload();
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page.getByText("PREPARATION")).toBeVisible();
  await page.reload();
  await playButton(page).waitFor();
  await expect(prompt(page)).toHaveCount(0);
});

test("resuming pays the same XP as never reloading, once", async ({ page, context }) => {
  // The same six minutes straight through, in a second guest's browser
  const control = await (await context.browser()!.newContext({ viewport: page.viewportSize() })).newPage();
  await control.clock.install();
  await finishGuestOnboarding(control, NO_BACKEND_URL, "Control");
  await startFirstSet(control);
  await train(control, 360);
  await control.clock.runFor(6000);
  const straightThrough = await finishAndLog(control);
  await control.context().close();

  await startFirstSet(page);
  await train(page, 360);
  await page.reload();
  await page.getByRole("button", { name: "Resume" }).click();
  await playButton(page).click();
  await page.clock.runFor(6000);
  const resumed = await finishAndLog(page);

  // Under the 10 XP start bonus, so paying that twice fails here too
  expect(Math.abs(resumed.xp - straightThrough.xp)).toBeLessThan(8);
  expect(resumed.badges).toBe(straightThrough.badges);
  await expect.poll(() => storedXP(page)).toBe(resumed.xp);

  // Logged means done: another reload neither asks nor pays
  expect(await savedSession(page)).toBeNull();
  await page.reload();
  await playButton(page).waitFor();
  await expect(prompt(page)).toHaveCount(0);
  expect(await storedXP(page)).toBe(resumed.xp);
});

test("a reload on the finished screen brings it back to log, and pays once", async ({ page }) => {
  await startFirstSet(page);
  await train(page, 360);
  await page.getByTitle("Complete workout early").click();
  await page.getByText("XP Breakdown").waitFor();
  const first = await earnedXP(page);
  expect(await storedXP(page)).toBe(0);

  await page.reload();
  await expect(page.getByText(/but didn't log it/)).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await page.getByText("XP Breakdown").waitFor();
  expect(await earnedXP(page)).toBe(first);
  await page.getByRole("button", { name: "Log Workout" }).click();
  await page.getByText("Workout Logged!").waitFor();
  await expect.poll(() => storedXP(page)).toBe(first);
});

test("leaving on purpose doesn't leave anything to resume", async ({ page }) => {
  await startFirstSet(page);
  await train(page, 30);
  await page.goBack();
  await page.getByRole("button", { name: "Leave" }).click();
  await page.getByText("Your Sets").waitFor();
  expect(await savedSession(page)).toBeNull();
  await expect(page.getByRole("button", { name: "Resume" })).toHaveCount(0);
});

test("home offers a killed session", async ({ page }) => {
  await startFirstSet(page);
  await train(page, 90);
  await page.goto(NO_BACKEND_URL);
  await expect(page.getByText(/You were \d+:\d+ into Beginner Loadout/)).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await page.waitForURL("**/session");
  await expect(prompt(page)).toHaveCount(0);
  await expect(page.getByText("PREPARATION")).toHaveCount(0);

  await page.goto(NO_BACKEND_URL);
  await page.getByRole("button", { name: "Discard" }).click();
  await expect(page.getByText(/You were/)).toHaveCount(0);
  expect(await savedSession(page)).toBeNull();
});

test("nothing is saved before a second is trained, or after a restart", async ({ page }) => {
  await startFirstSet(page);
  await page.clock.runFor(2000);
  expect(await savedSession(page)).toBeNull();
  await page.reload();
  await playButton(page).waitFor();
  await expect(prompt(page)).toHaveCount(0);

  await playButton(page).click();
  await train(page, 30);
  expect(await savedSession(page)).not.toBeNull();
  await page.getByTitle("Restart from beginning").click();
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(page.getByText("PREPARATION")).toBeVisible();
  expect(await savedSession(page)).toBeNull();
});

test("a workout edited since the save doesn't resume into the wrong place", async ({ page }) => {
  await startFirstSet(page);
  await train(page, 30);
  await page.evaluate(() => {
    const saved = JSON.parse(localStorage.getItem("get-clocked-session") as string);
    saved.segmentCount += 5;
    localStorage.setItem("get-clocked-session", JSON.stringify(saved));
  });
  await page.reload();
  await playButton(page).waitFor();
  await expect(prompt(page)).toHaveCount(0);
});

test("Quick Session has a link home, resumes after a reload, and pays once", async ({ page }) => {
  await page.getByRole("button", { name: /QUICK SESSION/ }).click();
  await page.waitForURL("**/quick-session");
  await playButton(page).click();
  await page.clock.fastForward(120_000);
  await page.reload();

  await expect(page.getByText(/into Quick Session/)).toBeVisible();
  await page.getByRole("button", { name: "Resume" }).click();
  await playButton(page).click();
  await page.clock.fastForward(60_000);
  await finishSessionButton(page).click();
  await page.getByText("SESSION COMPLETE!").waitFor();
  const xp = await earnedXP(page);
  expect(xp).toBeGreaterThan(0);
  await expect.poll(() => storedXP(page)).toBe(xp);

  // Finishing already paid. Coming back to the finished screen must not pay again.
  await page.reload();
  await page.getByRole("button", { name: "Resume" }).click();
  await page.getByText("SESSION COMPLETE!").waitFor();
  expect(await storedXP(page)).toBe(xp);
});

test("/onboarding sends a guest who finished it back to the app", async ({ page }) => {
  await page.goto(`${NO_BACKEND_URL}/onboarding`);
  await page.getByText("Your Sets").waitFor();
  await expect(page).toHaveURL(`${NO_BACKEND_URL}/`);
});

test("a shared speed bag phase keeps drills and punches apart", async ({ page }) => {
  await page.goto(`${NO_BACKEND_URL}/build`);
  await page.getByRole("button", { name: "Add Phase" }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const sheet = page.locator(".fixed.inset-0");
  await sheet.getByRole("button", { name: "Custom", exact: true }).click();
  await sheet.getByRole("button", { name: "1", exact: true }).click();
  await sheet.getByRole("button", { name: "Save", exact: true }).click();

  await page.getByRole("button", { name: "Add Segment" }).click();
  await page.locator("button.w-8.h-8.rounded-lg").nth(1).click();
  await page.getByRole("button", { name: "Add", exact: true }).last().click();
  await page.getByText("Double Left Lead").click();
  await page.locator("button:has(svg.lucide-chevron-up)").nth(1).click();

  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");
  await playButton(page).click();
  const skip = skipButton(page);
  await skip.click();
  await expect(page.getByText("INCOMING COMBO")).toBeVisible();
  await expect(page.getByText("Double Left Lead")).toHaveCount(0);
  await skip.click();
  await expect(page.locator("h2")).toHaveText(/speed bag/i);
  await expect(page.getByText("Double Left Lead")).toBeVisible();
  // Second time through, the punches ran out. The drill must not land on the shadowboxing round.
  await skip.click();
  await expect(page.locator("h2")).toHaveText(/shadowboxing/i);
  await expect(page.getByText("FREESTYLE")).toBeVisible();
  await expect(page.getByText("Double Left Lead")).toHaveCount(0);
});
