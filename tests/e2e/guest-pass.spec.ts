// Bugs found by walking the app as a guest.
import { Page } from "@playwright/test";
import { expect, test } from "./silent";
import { finishGuestOnboarding, NO_BACKEND_URL } from "./helpers";
import { playButton, pauseButton, skipButton } from "./controls";

const seedHistory = (page: Page, entries: { name: string; duration: number; at: string }[]) =>
  page.evaluate((rows) => {
    const stored = JSON.parse(localStorage.getItem("get-clocked-history") || '{"state":{},"version":0}');
    stored.state.guestHistory = rows.map((row, index) => ({
      id: `seed-${index}`,
      user_id: "guest",
      workout_id: null,
      workout_name: row.name,
      completed_at: row.at,
      duration: row.duration,
      xp_earned: 10,
      difficulty: null,
      notes: null,
      round_feedback: [],
      is_manual_entry: true,
    }));
    localStorage.setItem("get-clocked-history", JSON.stringify(stored));
  }, entries);

const openPresets = async (page: Page) => {
  await page.goto(`${NO_BACKEND_URL}/fight-club`);
  await page.getByRole("button", { name: "Presets" }).click();
};

const startFirstSet = async (page: Page) => {
  await playButton(page).click();
  await page.waitForURL("**/workout/**");
  await playButton(page).click();
  await pauseButton(page).waitFor();
};

test.beforeEach(async ({ page }) => {
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Guest Pass");
});

test("a saved preset keeps its phases and runs", async ({ page }) => {
  await openPresets(page);
  await page.getByText("Pro Loadout").first().click();
  await page.getByRole("button", { name: "Save to My Workouts" }).click();
  await page.goto(NO_BACKEND_URL);
  const card = page.locator("div:has(button:has(svg.lucide-play))").filter({ hasText: /^Pro Loadout/i }).last();
  await expect(card).not.toContainText("0 PHASES");
  await card.locator("button:has(svg.lucide-play)").click();
  await page.waitForURL("**/workout/**");
  await playButton(page).click();
  await skipButton(page).click();
  await expect(page.locator("h2")).not.toHaveText("PREPARATION");
});

test("customizing a preset opens that preset in the builder", async ({ page }) => {
  await openPresets(page);
  await page.getByText("Rookie Loadout").first().click();
  await page.getByRole("button", { name: "Customize in the Builder" }).click();
  await page.waitForURL("**/build**");
  await expect(page.getByPlaceholder("Workout Name")).toHaveValue("Rookie Loadout");
  await expect(page.getByText("Total: 0m")).toHaveCount(0);
});

test("a preset search with no match says so", async ({ page }) => {
  await openPresets(page);
  await page.getByPlaceholder("Search workouts...").fill("zzzz");
  await expect(page.getByText('No workouts match "zzzz".')).toBeVisible();
});

test("the calendar counts days trained, not sessions", async ({ page }) => {
  const now = new Date().toISOString();
  await seedHistory(page, [
    { name: "Morning", duration: 600, at: now },
    { name: "Evening", duration: 600, at: now },
  ]);
  await page.goto(`${NO_BACKEND_URL}/stats`);
  await expect(page.getByText("1 day", { exact: true })).toBeVisible();
});

test("the profile counts logged workouts, like stats does", async ({ page }) => {
  await seedHistory(page, [
    { name: "One", duration: 600, at: new Date().toISOString() },
    { name: "Two", duration: 1200, at: new Date().toISOString() },
  ]);
  await page.goto(`${NO_BACKEND_URL}/profile`);
  await expect(page.getByRole("button", { name: "2 Workouts" })).toBeVisible();
  await expect(page.getByText("30m total training")).toBeVisible();
});

test("the notes mic types what you say, never a canned line", async ({ page }) => {
  await page.addInitScript(() => {
    class StubRecognizer {
      onresult: ((event: unknown) => void) | null = null;
      onend: (() => void) | null = null;
      onerror: ((event: unknown) => void) | null = null;
      start() {
        setTimeout(() => {
          const result = Object.assign([{ transcript: "Worked my jab" }], { isFinal: true });
          this.onresult?.({ resultIndex: 0, results: [result] });
        }, 50);
      }
      stop() {
        this.onend?.();
      }
      abort() {}
    }
    Object.assign(window, { SpeechRecognition: StubRecognizer, webkitSpeechRecognition: StubRecognizer });
  });
  await page.goto(`${NO_BACKEND_URL}/history`);
  await page.getByRole("button", { name: "Log Workout" }).first().click();
  await page.getByRole("button", { name: "Dictate notes" }).click();
  const notes = page.getByPlaceholder("How did it go? What did you work on?");
  await expect(notes).toHaveValue("Worked my jab");
  await page.waitForTimeout(3500);
  await expect(notes).toHaveValue("Worked my jab");
});

test("there is no notes mic in a browser without speech recognition", async ({ page }) => {
  await page.addInitScript(() => {
    Object.assign(window, { SpeechRecognition: undefined, webkitSpeechRecognition: undefined });
  });
  await page.goto(`${NO_BACKEND_URL}/history`);
  await page.getByRole("button", { name: "Log Workout" }).first().click();
  await expect(page.getByPlaceholder("How did it go? What did you work on?")).toBeVisible();
  await expect(page.locator("button:has(svg.lucide-mic)")).toHaveCount(0);
});

test("skipping the last segment finishes the workout", async ({ page }) => {
  await page.goto(`${NO_BACKEND_URL}/build`);
  await page.getByRole("button", { name: "Add Phase" }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");
  await playButton(page).click();
  const skip = skipButton(page);
  await skip.click();
  await expect(page.locator("h2")).toHaveText(/shadowboxing/i);
  await skip.click();
  await expect(page.getByText("WORKOUT COMPLETE!")).toBeVisible();
});

test("back during a running workout asks first", async ({ page }) => {
  await startFirstSet(page);
  const url = page.url();
  await page.goBack();
  await expect(page.getByText("Leave Workout?")).toBeVisible();
  expect(page.url()).toBe(url);
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Leave Workout?")).toHaveCount(0);
  await page.goBack();
  await page.getByRole("button", { name: "Leave" }).click();
  await page.getByText("Your Sets").waitFor();
});

test("the AI Coach's Generate Workout actually builds one", async ({ page }) => {
  await page.goto(`${NO_BACKEND_URL}/history`);
  await page.getByRole("button", { name: "AI Coach" }).click();
  await page.getByRole("button", { name: "Generate Workout" }).click();
  await expect(page.getByText("Add Phase")).toBeVisible();
  await expect(page.getByText(/^Total: (?!0m)/)).toBeVisible({ timeout: 15_000 });
});

test("the builder won't save or start a workout with nothing to run", async ({ page }) => {
  await page.goto(`${NO_BACKEND_URL}/build`);
  for (const action of ["Save Workout", "Start"]) {
    await page.getByRole("button", { name: action, exact: true }).click();
    await expect(page.getByText("Add a phase with at least one segment first").first()).toBeVisible();
    expect(new URL(page.url()).pathname).toBe("/build");
  }

  await page.getByRole("button", { name: "Add Phase" }).click();
  const seconds = page.locator("input[type=number]").first();
  await seconds.fill("-30");
  await expect(seconds).toHaveValue("0");
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await expect(page.getByText('Give "Shadowboxing" a time first')).toBeVisible();
  expect(new URL(page.url()).pathname).toBe("/build");
});

test("a warmup with no combos stays freestyle when the rounds have some", async ({ page }) => {
  await page.goto(`${NO_BACKEND_URL}/build`);
  await page.getByRole("button", { name: "WARMUP" }).click();
  await page.getByRole("button", { name: "Add Phase" }).click();
  await page.getByRole("button", { name: "ROUNDS" }).click();
  await page.getByRole("button", { name: "Add Phase" }).click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const sheet = page.locator(".fixed.inset-0");
  await sheet.getByRole("button", { name: "Custom", exact: true }).click();
  await sheet.getByRole("button", { name: "1", exact: true }).click();
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");

  await playButton(page).click();
  const skip = skipButton(page);
  await skip.click();
  await expect(page.getByText("FREESTYLE")).toBeVisible();
  await skip.click();
  await skip.click();
  await expect(page.getByText("INCOMING COMBO")).toBeVisible();
});

test("restarting gets the same preparation and doesn't promise to save XP", async ({ page }) => {
  await startFirstSet(page);
  await skipButton(page).click();
  await expect(page.getByText("00:01").first()).toBeVisible();
  await page.getByTitle("Restart from beginning").click();
  await expect(page.getByText(/drops the \+1\d XP/)).toBeVisible();
  await page.getByRole("button", { name: "Restart", exact: true }).click();
  await expect(page.getByText("0:30")).toBeVisible();
});

test("restarting during the preparation has no XP to drop", async ({ page }) => {
  await startFirstSet(page);
  await page.getByTitle("Restart from beginning").click();
  await expect(page.getByText("This will reset the workout to the beginning.")).toBeVisible();
});

test("drills picked for a speed bag round show up in the session", async ({ page }) => {
  await page.goto(`${NO_BACKEND_URL}/build`);
  await page.getByRole("button", { name: "Add Phase" }).click();
  await page.locator("button.w-8.h-8.rounded-lg").first().click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByText("Double Left Lead").click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");
  await playButton(page).click();
  await skipButton(page).click();
  await expect(page.locator("h2")).toHaveText(/speed bag/i);
  await expect(page.getByText("Double Left Lead")).toBeVisible();
});

test("combos picked for a double-end round show up in the session", async ({ page }) => {
  await page.goto(`${NO_BACKEND_URL}/build`);
  await page.getByRole("button", { name: "Add Phase" }).click();
  const type = page.locator("button.w-8.h-8.rounded-lg").first();
  for (let i = 0; i < 3; i++) await type.click();
  await page.getByRole("button", { name: "Add", exact: true }).click();
  const sheet = page.locator(".fixed.inset-0");
  await sheet.getByRole("button", { name: "Custom", exact: true }).click();
  await sheet.getByRole("button", { name: "1", exact: true }).click();
  await sheet.getByRole("button", { name: "2", exact: true }).click();
  await sheet.getByRole("button", { name: "Save", exact: true }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");
  await playButton(page).click();
  await skipButton(page).click();
  await expect(page.locator("h2")).toHaveText(/double end/i);
  await expect(page.getByText("FREESTYLE")).toHaveCount(0);
});

test("a short set's card reads right", async ({ page }) => {
  await page.goto(`${NO_BACKEND_URL}/build`);
  await page.getByPlaceholder("Workout Name").fill("Quick One");
  await page.getByRole("button", { name: "Add Phase" }).click();
  await page.locator("input[type=number]").first().fill("30");
  await page.getByRole("button", { name: "Save Workout" }).click();
  await page.getByText("Your Sets").waitFor();
  await expect(page.getByText("1 PHASE", { exact: true })).toBeVisible();
  await expect(page.getByText("<1 MIN", { exact: true })).toBeVisible();
});

test("a long name can't push the profile sideways", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  const long = `Rocky ${"x".repeat(70)}`;
  await page.evaluate((name) => {
    const stored = JSON.parse(localStorage.getItem("get-clocked-user") as string);
    stored.state.user.name = name;
    stored.state.guestProfile = { ...stored.state.guestProfile, name };
    localStorage.setItem("get-clocked-user", JSON.stringify(stored));
  }, long);
  for (const route of ["/profile", "/edit-profile"]) {
    await page.goto(`${NO_BACKEND_URL}${route}`);
    await expect(page.getByText(/@rocky/).first()).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBe(0);
  }
});

test("onboarding caps the name and treats spaces as no name", async ({ page }) => {
  await page.evaluate(() => localStorage.clear());
  await page.goto(`${NO_BACKEND_URL}/onboarding`);
  await page.getByRole("button", { name: "GET STARTED" }).click();
  await page.getByText("I'M A FIGHTER").click();
  const name = page.getByPlaceholder("Your name");
  await name.fill("x".repeat(70));
  await expect(name).toHaveValue("x".repeat(30));
  await name.fill("   ");
  const start = page.getByRole("button", { name: "START TRAINING" });
  while (!(await start.isVisible())) await page.getByRole("button", { name: "Continue" }).click();
  await start.click();
  await page.getByText("Your Sets").waitFor();
  await page.goto(`${NO_BACKEND_URL}/profile`);
  await expect(page.getByText("@fighter")).toBeVisible();
});

test("nothing covers the workout controls right after Start", async ({ page }) => {
  await page.goto(`${NO_BACKEND_URL}/build`);
  await page.getByRole("button", { name: "Add Phase" }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");
  await expect(playButton(page)).toBeVisible();
  // Read once, after a toast would have landed. A retrying assertion just waits for it to expire.
  await page.waitForTimeout(500);
  expect(await page.locator("[data-sonner-toast]").count()).toBe(0);
});

test("the AI builder fits a small phone", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 568 });
  await page.goto(`${NO_BACKEND_URL}/build`);
  await page.getByRole("button", { name: "AI Builder" }).click();
  await page.locator("textarea").fill("6 rounds heavy bag");
  await page.getByRole("button", { name: /Generate/ }).last().click();
  await expect(page.getByPlaceholder("Workout Name")).not.toHaveValue("", { timeout: 15_000 });
  await expect(page.getByText(/^Total: (?!0m)/)).toBeVisible();
});
