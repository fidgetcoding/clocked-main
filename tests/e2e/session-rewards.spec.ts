// XP and badges have to reflect what a session really did. The browser's clock is moved by hand, so
// nothing here depends on how long a click takes.
import { Page } from "@playwright/test";
import { expect, test } from "./silent";
import { finishGuestOnboarding, NO_BACKEND_URL, startTraining } from "./helpers";

const summaryTotal = (page: Page) => page.getByText(/^\+[\d,]+$/).first();

const startHomeWorkout = async (page: Page) => {
  await page.locator("button:has(svg.lucide-play)").first().click();
  await page.waitForURL("**/workout/**");
  await page.locator("button:has(svg.lucide-play)").first().click();
  await page.locator("button:has(svg.lucide-pause)").waitFor();
};

const finishEarly = async (page: Page) => {
  await page.getByTitle("Complete workout early").click();
  await page.getByText("XP Breakdown").waitFor();
};

test.beforeEach(async ({ page }) => {
  await page.clock.install();
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Effort Check");
});

test("pressing -30 until a run ends trains nothing and earns nothing", async ({ page }) => {
  await page.goto(`${NO_BACKEND_URL}/build`);
  await page.getByRole("button", { name: "Add Phase" }).click();
  await page.getByRole("button", { name: "Start", exact: true }).click();
  await page.waitForURL("**/session");
  await page.locator("button:has(svg.lucide-play)").first().click();
  // Still in the preparation, and frozen there. A frozen clock stops Playwright's checks too, so dispatch the clicks.
  await page.clock.pauseAt(Date.now() + 2000);

  const complete = page.getByText("WORKOUT COMPLETE!");
  const minus30 = page.getByRole("button", { name: "-30s" });
  for (let press = 0; press < 60 && !(await complete.isVisible()); press++) {
    // The press before this one can end the run, and then the button is gone
    await minus30.dispatchEvent("click", undefined, { timeout: 1000 }).catch(() => {});
  }

  await expect(complete).toBeVisible();
  await expect(page.getByText("00:00").first()).toBeVisible();
  await expect(summaryTotal(page)).toHaveText("+0");
  await expect(page.getByText("Train for at least 5 minutes")).toBeVisible();
});

test("waiting out the preparation isn't training", async ({ page }) => {
  await startHomeWorkout(page);
  await page.clock.fastForward(6 * 60 * 1000);
  await finishEarly(page);

  await expect(page.getByText("Train for at least 5 minutes")).toBeVisible();
  await expect(page.getByText(/Badge XP/)).toHaveCount(0);
  await expect(summaryTotal(page)).toHaveText("+0");
});

test("the bonus for starting lands with the first second trained", async ({ page }) => {
  await startHomeWorkout(page);
  await page.locator("button:has(svg.lucide-skip-forward)").click();
  await page.clock.fastForward(1000);
  await expect(page.getByText("00:01").first()).toBeVisible();
  await finishEarly(page);
  await expect(summaryTotal(page)).toHaveText(/^\+1\d$/);
});

test("a first 6-minute run left unfinished earns showing up, not the big first-workout badges", async ({ page }) => {
  await startTraining(page);
  await page.clock.fastForward(6 * 60 * 1000);
  await page.getByText("6:00").first().waitFor();
  await finishEarly(page);

  await expect(page.getByRole("heading", { name: "Badges Earned (2)" })).toBeVisible();
  await expect(page.getByText("First Blood").first()).toBeVisible();
  await expect(page.getByText("Day One").first()).toBeVisible();
  for (const badge of ["Full Send", "Push Through", "Beast Mode Achiever", "Rapid Fire"]) {
    await expect(page.getByText(badge)).toHaveCount(0);
  }
});

test("a whole workout run to its end earns the finishing badges", async ({ page }) => {
  await startTraining(page);
  await page.clock.fastForward(45 * 60 * 1000);
  await page.getByText("WORKOUT COMPLETE!").waitFor();

  for (const badge of ["Full Send", "Push Through", "Beast Mode Achiever"]) {
    await expect(page.getByText(badge).first()).toBeVisible();
  }
});

test("pausing costs Push Through, and skipping costs Full Send too", async ({ page }) => {
  await startTraining(page);
  await page.locator("button:has(svg.lucide-pause)").click();
  await page.locator("button:has(svg.lucide-play)").first().click();
  await page.clock.fastForward(45 * 60 * 1000);
  await page.getByText("WORKOUT COMPLETE!").waitFor();
  await expect(page.getByText("Full Send").first()).toBeVisible();
  await expect(page.getByText("Push Through")).toHaveCount(0);

  await page.getByRole("button", { name: "Back to Home" }).click();
  await page.getByText("Your Sets").waitFor();
  await startTraining(page);
  await page.locator("button:has(svg.lucide-skip-forward)").click();
  await page.clock.fastForward(45 * 60 * 1000);
  await page.getByText("WORKOUT COMPLETE!").waitFor();
  await expect(page.getByText("Full Send")).toHaveCount(0);
});
