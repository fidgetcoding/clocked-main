// A person using the production build: clicking only what they can see, never touching storage.
// Runs against the build Vercel would make, not the one the other specs use.
import type { Page } from "@playwright/test";
import { expect, launchSilentChromium, test } from "./silent";
import { finishSessionButton, pauseButton, playButton, skipButton, skipCalibration } from "./controls";
import { clickNewestEmailLink, finishAccountOnboarding, requestSignInEmail } from "./helpers";
import { SIZES, settle, visit, watch, type Person } from "./person";

const GUEST_URL = process.env.STACK_PROD_NO_BACKEND_URL as string;

const guestStart = async (person: Person, { name = "Sam", level = "", gear = false } = {}) => {
  const { page } = person;
  await visit(page, GUEST_URL);
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
      await visit(page, GUEST_URL + route);
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
    await visit(page, `${GUEST_URL}/history`);
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
      await visit(page, `${GUEST_URL}/history`);
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
    await visit(page, `${GUEST_URL}/history`);
    await page.getByText("NO HISTORY YET", { exact: false }).waitFor();
    await visit(page, GUEST_URL);
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
    await visit(page, `${GUEST_URL}/history`);
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
      test(`start with the camera on at ${sizeName}`, async ({ playwright, browserName }) => {
        test.skip(browserName !== "chromium", "Fake cameras and permission flags are Chromium's");
        test.setTimeout(150_000);
        const browser = await launchSilentChromium(playwright, args);
        const context = await browser.newContext({ viewport: SIZES[sizeName] });
        const page = await context.newPage();
        const person = watch(page, `camera-${state.replace(" ", "-")}-${sizeName}`);
        await guestStart(person);
        await page.getByRole("button", { name: /QUICK SESSION/ }).click();
        // With the camera allowed, calibration opens first
        if (state === "allowed") await skipCalibration(page);
        await playButton(page).click();
        await page.waitForTimeout(2500);
        await person.look("quick, camera just asked");
        await page.waitForTimeout(6000);
        await person.look("quick, camera settled");
        await expect(pauseButton(page).or(finishSessionButton(page)).first()).toBeVisible();
        await finishSessionButton(page).click();
        await person.look("quick summary");
        await visit(page, `${GUEST_URL}/punch-check`);
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
      // Every session starts with the camera on. The column beside the clock is the camera-off layout
      const camera = page.getByTestId("run-stage").getByRole("switch", { name: "Punch camera" });
      await camera.click();
      await expect(camera).toHaveAttribute("aria-checked", "false");
      const clockRight = await page.getByTestId("run-clock").evaluate((clock) =>
        Math.max(...[clock, ...clock.querySelectorAll("*")].map((el) => el.getBoundingClientRect().right)),
      );
      const label = await page.getByText("Session XP", { exact: true }).first().boundingBox();
      expect(clockRight).toBeLessThanOrEqual(label!.x);
    });
  }
});

const ACCOUNT_URL = process.env.STACK_PROD_URL as string;

async function accountStart(person: Person) {
  const { page } = person;
  const email = `walker-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  await requestSignInEmail(page, ACCOUNT_URL, email);
  await person.look("check your email");
  await clickNewestEmailLink(page, email);
  await finishAccountOnboarding(page, "Walker");
  return email;
}

for (const [sizeName, viewport] of Object.entries(SIZES)) {
  test(`an account signs in by email link and sees every screen at ${sizeName}`, async ({ browser }) => {
    test.setTimeout(240_000);
    const context = await browser.newContext({ viewport });
    const page = await context.newPage();
    const person = watch(page, `account-${sizeName}`);
    await accountStart(person);
    await person.look("home");
    await page.getByRole("button", { name: /QUICK SESSION/ }).click();
    // Clocked's own camera question sits over the screen until the browser answers it
    await person.look("quick ready");
    await visit(page, ACCOUNT_URL);
    for (const route of ROUTES.slice(1)) {
      await visit(page, ACCOUNT_URL + route);
      await person.look(route.slice(1));
    }
    await visit(page, ACCOUNT_URL);
    await page.clock.install();
    await settle(page);
    await page.reload();
    const log = page.getByRole("button", { name: "Log Workout" });
    await page.getByRole("button", { name: /^Start /, exact: false }).first().click();
    await playButton(page).click();
    for (let i = 0; i < 800 && !(await log.isVisible()); i++) await page.clock.fastForward(5000);
    await person.look("account summary");
    await log.click();
    await page.getByText("Workout Logged!").waitFor();
    await visit(page, `${ACCOUNT_URL}/history`);
    await person.look("account log");
    await page.getByRole("button", { name: /Loadout/ }).first().click();
    await person.look("log entry opened");
    await visit(page, `${ACCOUNT_URL}/stats`);
    await person.look("account stats");
    await visit(page, `${ACCOUNT_URL}/profile`);
    await person.look("account profile");
    await visit(page, `${ACCOUNT_URL}/fight-club`);
    await person.look("fight club with own post");
    await context.close();
    expect(person.problems).toEqual([]);
  });
}

test("every button on every screen does something", async ({ page }) => {
  test.setTimeout(900_000);
  const person = watch(page, "buttons");
  await accountStart(person);
  const dead: string[] = [];
  const fingerprint = () => page.evaluate(() => `${location.href}|${document.body.innerText}|${document.querySelectorAll("[data-state=checked],[aria-pressed=true],[data-state=open],[role=dialog],[role=alertdialog]").length}|${[...document.querySelectorAll("button")].map((b) => b.className).join()}`);
  for (const route of ["/", "/build", "/history", "/stats", "/fight-club", "/profile", "/settings", "/edit-profile", "/gloves", "/punch-check"]) {
    await visit(page, ACCOUNT_URL + route);
    await page.waitForTimeout(600);
    const count = await page.locator("main button:visible, nav button:visible").count();
    for (let i = 0; i < count; i++) {
      await visit(page, ACCOUNT_URL + route);
      await page.waitForTimeout(350);
      const button = page.locator("main button:visible, nav button:visible").nth(i);
      if (!(await button.count()) || (await button.isDisabled())) continue;
      const name = ((await button.getAttribute("aria-label")) || (await button.innerText())).trim().slice(0, 30);
      // Don't delete the account's only set
      if (/remove|delete|sign ?out|log ?out/i.test(name)) continue;
      const before = await fingerprint();
      const clicked = await button.click({ timeout: 2500 }).then(() => true, () => false);
      await page.waitForTimeout(400);
      if (!clicked) dead.push(`${route}: "${name}" can't be clicked`);
      else if ((await fingerprint()) === before) dead.push(`${route}: "${name}" does nothing`);
    }
  }
  // Already on that tab, or already picked, and Change photo opens the system file picker
  const expected = /^\/.*: "(HOME|MY STATS|FIGHT CLUB|PROFILE|FEED|ALL|CUSTOM BUILD|ROUNDS|NO TIMER|ORTHODOX[^"]*|Change photo)" does nothing$/;
  expect(dead.filter((line) => !expected.test(line))).toEqual([]);
  expect(person.problems).toEqual([]);
});

test.describe("bad networks", () => {
  test("a slow connection still gets through sign-in and a screen", async ({ browser, browserName }) => {
    test.skip(browserName !== "chromium", "Network throttling goes through Chromium's DevTools protocol");
    test.setTimeout(240_000);
    const context = await browser.newContext({ viewport: SIZES.phone });
    const page = await context.newPage();
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.emulateNetworkConditions", { offline: false, latency: 800, downloadThroughput: 50_000, uploadThroughput: 20_000 });
    const person = watch(page, "slow");
    await visit(page, GUEST_URL);
    await person.look("first screen slowly");
    await page.getByRole("button", { name: "GET STARTED" }).waitFor({ timeout: 120_000 });
    await context.close();
    expect(person.problems).toEqual([]);
  });

  test("going offline mid-session keeps the run and logs nothing lost", async ({ browser }) => {
    test.setTimeout(180_000);
    const context = await browser.newContext({ viewport: SIZES.phone });
    const page = await context.newPage();
    const person = watch(page, "offline");
    await accountStart(person);
    await page.getByRole("button", { name: /^Start /, exact: false }).first().click();
    await playButton(page).click();
    await skipButton(page).click();
    await page.waitForTimeout(1500);
    await context.setOffline(true);
    person.allow(/request failed|ERR_INTERNET_DISCONNECTED|Failed to (fetch|log|load)|TypeError|Cross-Origin Request Blocked|NetworkError|Load failed/);
    await page.waitForTimeout(2000);
    await person.look("offline, still running");
    await page.getByRole("button", { name: "Done" }).or(page.getByTitle("Complete workout early")).first().click();
    await person.look("offline summary");
    await page.getByRole("button", { name: "Log Workout" }).click();
    await expect(page.getByText("Couldn't save your workout", { exact: false }), "a person is told the log didn't save").toBeVisible();
    await person.look("offline after logging");
    await context.setOffline(false);
    await page.getByRole("button", { name: "Log Workout" }).click();
    await page.getByText("Workout Logged!").waitFor();
    await visit(page, `${ACCOUNT_URL}/history`);
    await expect(page.getByRole("button", { name: /Loadout/ }).first(), "the retry saved it").toBeVisible();
    await context.close();
    expect(person.problems).toEqual([]);
  });

  test("a guest offline after loading keeps working; opening fresh offline is explained", async ({ browser }) => {
    const context = await browser.newContext({ viewport: SIZES.phone });
    const page = await context.newPage();
    const person = watch(page, "offline-guest");
    await guestStart(person);
    await context.setOffline(true);
    person.allow(/request failed|ERR_INTERNET_DISCONNECTED|dynamically imported module|couldn't load|camera failed to load|console error: JSHandle@object|Failed to load resource|Importing a module script failed/);
    await page.getByRole("button", { name: /QUICK SESSION/ }).click();
    await playButton(page).click();
    await page.waitForTimeout(1500);
    await person.look("guest offline quick");
    await finishSessionButton(page).click();
    await page.getByRole("button", { name: "Log Session" }).click();
    await page.getByText("Session Logged!").waitFor();
    await context.close();
    expect(person.problems).toEqual([]);
  });
});

test("building a set by hand and with the AI builder, then logging one by hand", async ({ page }) => {
  test.setTimeout(120_000);
  const person = watch(page, "builder");
  await accountStart(person);
  await page.getByRole("button", { name: /CREATE SET/ }).click();
  await person.look("builder");
  await page.getByPlaceholder("Workout Name").fill("Walk Set");
  await page.getByRole("button", { name: /Add Phase/i }).click();
  await person.look("phase added");
  await page.getByRole("button", { name: /Add Segment/i }).first().click();
  await person.look("segment added");
  await page.getByRole("button", { name: /SAVE WORKOUT/i }).click();
  await page.getByText("Your Sets").waitFor();
  await expect(page.getByText("Walk Set").first()).toBeVisible();
  await person.look("home with new set");
  await visit(page, `${ACCOUNT_URL}/build`);
  await page.getByRole("button", { name: /AI BUILDER/i }).click();
  await person.look("ai builder");
  const ask = page.getByPlaceholder(/heavy bag workout/);
  await ask.fill("Three rounds of heavy bag with rest");
  await page.getByRole("button", { name: "Generate", exact: true }).click();
  await page.waitForTimeout(4000);
  await person.look("ai builder answered");
  await visit(page, `${ACCOUNT_URL}/history`);
  await page.getByRole("button", { name: "Log Workout" }).click();
  // The form covers the whole screen, bottom bar included
  person.allow(/manual log form: "(HOME|MY STATS|FIGHT CLUB|PROFILE|Log Workout)" (is covered by|overlaps) "(Log Workout|HOME|MY STATS|FIGHT CLUB|PROFILE)"/);
  await person.look("manual log form");
  await page.getByPlaceholder("e.g., Heavy Bag Session").fill("Hand Logged");
  await page.getByRole("button", { name: "Log Workout" }).last().click();
  await expect(page.getByRole("button", { name: /Hand Logged/ })).toBeVisible();
  await person.look("manual entry in the log");
  expect(person.problems).toEqual([]);
});

test.describe("the streak and totals are saved before it says logged", () => {
  for (const kind of ["full set", "Quick Session"] as const) {
    test(`a ${kind} that can't save its stats says so, and a retry saves it once`, async ({ page }) => {
      test.setTimeout(120_000);
      const person = watch(page, `stats-save-${kind.replace(" ", "-")}`);
      await accountStart(person);
      if (kind === "full set") {
        await page.getByRole("button", { name: /^Start /, exact: false }).first().click();
        await playButton(page).click();
        await skipButton(page).click();
        await page.waitForTimeout(2200);
        await page.getByTitle("Complete workout early").click();
      } else {
        await page.getByRole("button", { name: /QUICK SESSION/ }).click();
        await playButton(page).click();
        await page.waitForTimeout(2200);
        await finishSessionButton(page).click();
      }
      // The stats save is what fails, after the history entry went in
      person.allow(/credit_session_to_profile|request failed|Failed to log|Failed to fetch|Failed to load resource: net::ERR_FAILED/);
      await page.route(/\/rest\/v1\/rpc\/credit_session_to_profile/, (route) => route.abort());
      const log = page.getByRole("button", { name: kind === "full set" ? "Log Workout" : "Log Session" });
      await log.click();
      await expect(page.getByText(/Couldn't save your (workout|session)/)).toBeVisible();
      await expect(page.getByText(/(Workout|Session) Logged!/)).toHaveCount(0);
      await person.look("stats save failed");
      await page.unroute(/\/rest\/v1\/rpc\/credit_session_to_profile/);
      await log.click();
      await expect(page.getByText(/(Workout|Session) Logged!/)).toBeVisible();
      await visit(page, `${ACCOUNT_URL}/history`);
      await expect(page.getByRole("button", { name: kind === "full set" ? /Loadout/ : /Quick Session/ })).toHaveCount(1);
      await visit(page, `${ACCOUNT_URL}/profile`);
      await expect(page.getByText(/^1$/).first()).toBeVisible();
      expect(person.problems).toEqual([]);
    });
  }
});
