// A person using the production build: clicking only what they can see, never touching storage.
// Runs against the build Vercel would make, not the one the other specs use.
import type { Page } from "@playwright/test";
import { expect, launchSilentChromium, test } from "./silent";
import { finishSessionButton, pauseButton, playButton, skipButton } from "./controls";
import { SIZES, watch, type Person } from "./person";

const GUEST_URL = process.env.STACK_PROD_NO_BACKEND_URL as string;

const guestStart = async (person: Person, { name = "Sam", level = "", gear = false } = {}) => {
  const { page } = person;
  await page.goto(GUEST_URL);
  await person.look("first screen");
  await page.getByRole("button", { name: "GET STARTED" }).click();
  await person.look("onboarding who");
  await page.getByText("I'M A FIGHTER").click();
  await page.getByPlaceholder("Your name").fill(name);
  const start = page.getByRole("button", { name: "START TRAINING" });
  const next = page.getByRole("button", { name: "Continue" });
  for (let step = 0; step < 12 && !(await start.isVisible()); step++) {
    await person.look(`onboarding step ${step}`);
    if (level && (await page.getByText(level, { exact: true }).isVisible())) await page.getByText(level, { exact: true }).click();
    if (gear && (await page.getByText("BOXING GLOVES", { exact: false }).first().isVisible()) && (await page.getByText("YOUR EQUIPMENT").isVisible().catch(() => false))) {
      for (const item of ["Boxing Gloves", "Hand Wraps", "Heavy Bag", "Double End Bag", "Speed Bag", "Jump Rope", "Treadmill"]) await page.getByText(item, { exact: true }).click();
    }
    await next.click();
    await expect(start.or(next)).toBeVisible();
  }
  await person.look("onboarding done");
  await start.click();
  await page.getByText("Your Sets").waitFor();
};

const ROUTES = ["/", "/build", "/history", "/stats", "/fight-club", "/profile", "/settings", "/edit-profile", "/gloves", "/auth", "/admin", "/punch-check", "/quick-session", "/no-such-page"];

for (const [sizeName, viewport] of Object.entries(SIZES)) {
  test(`every screen as a guest at ${sizeName}`, async ({ browser }) => {
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const person = watch(page, `guest-${sizeName}`);
    await guestStart(person);
    for (const route of ROUTES) {
      await page.goto(GUEST_URL + route);
      await person.look(route.slice(1) || "home");
    }
    await context.close();
    expect(person.problems).toEqual([]);
  });
}

const stageState = (page: Page) =>
  page.getByTestId("run-stage").evaluate((stage) => `${stage.getAttribute("data-tone")}`);

/** Plays a whole set with the clock sped up, looking at the screen each time it changes. */
async function playToTheEnd(person: Person) {
  const { page } = person;
  await page.getByRole("button", { name: /^Start /, exact: false }).first().click();
  await page.waitForURL("**/workout/**");
  await person.look("before the start");
  await playButton(page).click();
  await person.look("preparation");
  const seen = new Set<string>();
  const log = page.getByRole("button", { name: "Log Workout" });
  for (let i = 0; i < 2400 && !(await log.isVisible()); i++) {
    await page.clock.fastForward(5000);
    if (await log.isVisible()) break;
    if (!(await page.getByTestId("run-stage").isVisible())) continue;
    const tone = await stageState(page);
    const title = await page.getByTestId("run-stage").innerText();
    const key = `${tone}|${/COMBO|DRILL|FREESTYLE|REST|ROUND/i.exec(title)?.[0] ?? ""}`;
    if (!seen.has(key)) {
      seen.add(key);
      await person.look(`segment ${key}`);
    }
  }
  await expect(log).toBeVisible();
  await person.look("summary");
  await log.click();
  await page.getByRole("button", { name: /Home/i }).waitFor();
  await person.look("summary logged");
  return seen;
}

const FULL_RUNS = [
  { level: "Rookie", size: "smallPhone" },
  { level: "Beginner", size: "phone" },
  { level: "Intermediate", size: "proppedPhone" },
  { level: "Advanced", size: "laptop" },
  { level: "Pro", size: "desktop" },
] as const;

for (const { level, size } of FULL_RUNS) {
  test(`a ${level} plays their whole set at ${size} and logs it`, async ({ browser }) => {
    test.setTimeout(600_000);
    const context = await browser.newContext({ viewport: SIZES[size] });
    const page = await context.newPage();
    await page.clock.install();
    const person = watch(page, `full-${level}-${size}`);
    await guestStart(person, { level, gear: true });
    const seen = await playToTheEnd(person);
    console.log(level, [...seen].join(", "));
    await page.getByRole("button", { name: /Home/i }).click();
    await page.getByText("Your Sets").waitFor();
    await person.look("home after");
    for (const tab of ["MY STATS", "PROFILE"]) {
      await page.getByRole("link", { name: tab }).or(page.getByRole("button", { name: tab })).first().click();
      await person.look(tab);
    }
    await page.goto(`${GUEST_URL}/history`);
    await person.look("log");
    await context.close();
    expect(person.problems).toEqual([]);
  });
}

test.describe("controls on a running set", () => {
  for (const [sizeName, viewport] of Object.entries(SIZES)) {
    test(`pause, skip, back, +30s, reload, resume, leave at ${sizeName}`, async ({ browser }) => {
      test.setTimeout(180_000);
      const context = await browser.newContext({ viewport });
      const page = await context.newPage();
      const person = watch(page, `controls-${sizeName}`);
      await guestStart(person);
      await page.getByRole("button", { name: /^Start /, exact: false }).first().click();
      await playButton(page).click();
      await pauseButton(page).click();
      await person.look("paused in prep");
      await playButton(page).click();
      await skipButton(page).click();
      await page.waitForTimeout(2200);
      await person.look("training");
      const clock = page.getByTestId("run-clock");
      const seconds = async () => {
        const [m, s] = (await clock.getAttribute("aria-label"))!.split(" ")[0].split(":").map(Number);
        return m * 60 + s;
      };
      const before = await seconds();
      await page.getByRole("button", { name: /\+\s*30/ }).first().click();
      expect(await seconds(), "+30s adds time").toBeGreaterThan(before + 20);
      await skipButton(page).click();
      await page.getByRole("button", { name: "Back one segment" }).click();
      await page.waitForTimeout(1200);
      await page.reload();
      await page.getByText(/resume/i).first().waitFor();
      await person.look("resume offer after reload");
      await page.getByRole("button", { name: "Resume" }).click();
      await person.look("resumed, paused");
      await playButton(page).click();
      await page.waitForTimeout(1200);
      await page.goBack();
      await page.getByText("Leave Workout?").waitFor();
      await person.look("browser back asks");
      await page.getByRole("button", { name: "Cancel" }).click();
      await page.getByRole("button", { name: "Leave workout" }).click();
      await page.getByRole("button", { name: "End & Save" }).click();
      await page.getByText("Your Sets").waitFor();
      await page.goto(`${GUEST_URL}/history`);
      await expect(page.getByText("Beginner Loadout").first()).toBeVisible();
      await person.look("saved in the log");
      await context.close();
      expect(person.problems).toEqual([]);
    });
  }

  test("Quick Session: leave without saving, then end and save, then finish", async ({ page }) => {
    test.setTimeout(120_000);
    const person = watch(page, "quick");
    await guestStart(person);
    const quick = async () => {
      await page.getByRole("button", { name: /QUICK SESSION/ }).click();
      await playButton(page).click();
      await page.waitForTimeout(1500);
    };
    await quick();
    await person.look("running");
    await page.getByRole("button", { name: "Leave workout" }).click();
    await person.look("leave asks");
    await page.getByRole("button", { name: "Leave Without Saving" }).click();
    await page.getByText("Your Sets").waitFor();
    await page.goto(`${GUEST_URL}/history`);
    await page.getByText("NO HISTORY YET", { exact: false }).waitFor();
    await page.goto(GUEST_URL);
    await quick();
    await page.reload();
    await page.getByRole("button", { name: "Resume" }).click();
    await person.look("quick resumed");
    await playButton(page).click();
    await page.waitForTimeout(1500);
    await page.getByRole("button", { name: "Leave workout" }).click();
    await page.getByRole("button", { name: "End & Save" }).click();
    await page.getByText("Your Sets").waitFor();
    await person.look("home with tape");
    await quick();
    await finishSessionButton(page).click();
    await person.look("quick summary");
    await page.getByRole("button", { name: "Log Session" }).click();
    await page.getByText("Session Logged!").waitFor();
    await page.getByRole("button", { name: "Back to Home" }).click();
    await page.goto(`${GUEST_URL}/history`);
    await person.look("log with sessions");
    expect(person.problems).toEqual([]);
  });
});

const FAKE_CAMERA = "--use-fake-device-for-media-stream";
const CAMERA_STATES = [
  { state: "allowed", args: [FAKE_CAMERA, "--use-fake-ui-for-media-stream"] },
  { state: "denied", args: [FAKE_CAMERA, "--deny-permission-prompts"] },
  { state: "no camera", args: [`${FAKE_CAMERA}=device-count=0`, "--use-fake-ui-for-media-stream"] },
  { state: "prompt pending", args: [FAKE_CAMERA] },
];

for (const { state, args } of CAMERA_STATES) {
  test.describe(`camera ${state}`, () => {
    for (const sizeName of ["phone", "proppedPhone", "laptop"] as const) {
      test(`start with the camera on at ${sizeName}`, async ({ playwright }) => {
        test.setTimeout(150_000);
        const browser = await launchSilentChromium(playwright, args);
        const context = await browser.newContext({ viewport: SIZES[sizeName] });
        const page = await context.newPage();
        const person = watch(page, `camera-${state.replace(" ", "-")}-${sizeName}`);
        await guestStart(person);
        await page.getByRole("button", { name: /QUICK SESSION/ }).click();
        await playButton(page).click();
        await page.waitForTimeout(2500);
        await person.look("quick, camera just asked");
        await page.waitForTimeout(6000);
        await person.look("quick, camera settled");
        await expect(pauseButton(page).or(finishSessionButton(page)).first()).toBeVisible();
        await finishSessionButton(page).click();
        await person.look("quick summary");
        await page.goto(`${GUEST_URL}/punch-check`);
        await person.look("punch check setup");
        await page.getByRole("button", { name: /START CAMERA/i }).click();
        await page.waitForTimeout(6000);
        await person.look("punch check after start");
        await browser.close();
        expect(person.problems).toEqual([]);
      });
    }
  });
}

test.describe("things a person noticed", () => {
  test("a new screen opens at its top, not scrolled down like the last one", async ({ page }) => {
    await page.setViewportSize(SIZES.smallPhone);
    await guestStart(watch(page, "scroll"));
    await page.getByText("Your Sets").scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    expect(await page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
    await page.getByText("MY STATS").first().click();
    await page.waitForURL("**/stats");
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  });

  test("the first round is Round 1, not the Get Ready before it", async ({ page }) => {
    await page.clock.install();
    await guestStart(watch(page, "rounds"));
    await page.getByRole("button", { name: /^Start /, exact: false }).first().click();
    await playButton(page).click();
    await skipButton(page).click();
    await skipButton(page).click();
    await expect(page.getByText("Round 1 of", { exact: false }).or(page.getByText("Round 2 of", { exact: false })).first()).toBeHidden();
    await skipButton(page).click();
    await page.clock.fastForward(1000);
    await expect(page.getByTestId("run-stage")).toContainText(/Round\s*1\s*of/i);
  });

  test("the duration fits beside a four-digit XP total on a small phone", async ({ page }) => {
    await page.setViewportSize(SIZES.smallPhone);
    await page.clock.install();
    await guestStart(watch(page, "summary-fit"));
    await page.getByRole("button", { name: /^Start /, exact: false }).first().click();
    await playButton(page).click();
    for (let i = 0; i < 600 && !(await page.getByRole("button", { name: "Log Workout" }).isVisible()); i++) await page.clock.fastForward(5000);
    const duration = page.getByText("Duration", { exact: true });
    const box = (await duration.boundingBox())!;
    expect(box.x + box.width).toBeLessThanOrEqual(SIZES.smallPhone.width);
  });

  test("Quick Session has no empty Up next row", async ({ page }) => {
    await guestStart(watch(page, "up-next"));
    await page.getByRole("button", { name: /QUICK SESSION/ }).click();
    await expect(page.getByTestId("run-stage")).toBeVisible();
    await expect(page.getByText("Up next", { exact: true })).toHaveCount(0);
  });

  for (const sizeName of ["proppedPhone", "laptop"] as const) {
    test(`the clock's slant stays out of the column beside it at ${sizeName}`, async ({ page }) => {
      await page.setViewportSize(SIZES[sizeName]);
      await guestStart(watch(page, `slant-${sizeName}`));
      await page.getByRole("button", { name: /^Start /, exact: false }).first().click();
      const clockRight = await page.getByTestId("run-clock").evaluate((clock) =>
        Math.max(...[clock, ...clock.querySelectorAll("*")].map((el) => el.getBoundingClientRect().right)),
      );
      const label = await page.getByText("Session XP", { exact: true }).first().boundingBox();
      expect(clockRight).toBeLessThanOrEqual(label!.x);
    });
  }
});
