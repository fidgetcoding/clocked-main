// With the camera on, a Quick Session logs every punch: live, in the summary, and in history.
// There is no real camera or person here. The camera is a blank canvas and the pose model is fed
// synthetic poses through the real detector, so this proves the logging, not how well the detector
// reads real people.
import type { Page } from "@playwright/test";
import { simulate, type SynthPunch } from "../../src/test/punchSynth";
import { expect, test } from "./silent";
import { finishSessionButton, playButton, skipCalibration } from "./controls";
import {
  APP_URL,
  clickNewestEmailLink,
  finishAccountOnboarding,
  finishGuestOnboarding,
  NO_BACKEND_URL,
  requestSignInEmail,
  service,
  userIdFor,
} from "./helpers";

declare global {
  interface Window {
    __e2ePoseFeed?: (timestampMs: number) => { image: unknown; world: unknown };
  }
}

const PUNCHES: SynthPunch[] = [
  { hand: "lead", shape: "straight", at: 1500 },
  { hand: "rear", shape: "straight", at: 2100 },
  { hand: "lead", shape: "hook", at: 2800, otherHandDrops: true },
  { hand: "rear", shape: "straight", at: 6000 },
];
const DURATION_MS = 8000;

const fakeCameraAndPoses = async (page: Page) => {
  const frames = simulate({ durationMs: DURATION_MS, fps: 30, punches: PUNCHES });
  await page.context().addInitScript((recorded) => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 48;
    const context = canvas.getContext("2d") as CanvasRenderingContext2D;
    let tick = 0;
    setInterval(() => {
      context.fillStyle = `rgb(${tick++ % 255}, 90, 90)`;
      context.fillRect(0, 0, 64, 48);
    }, 33);
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => canvas.captureStream(30) },
    });
    let first: number | null = null;
    window.__e2ePoseFeed = (timestampMs: number) => {
      // The camera is up before the session starts, so the punches wait for counting to begin
      if (!document.querySelector('[data-counting="true"]') && first === null) return { image: recorded[0].landmarks, world: recorded[0].landmarks };
      first ??= timestampMs;
      const at = timestampMs - first;
      const frame = recorded.find((candidate) => candidate.t >= at) ?? recorded[recorded.length - 1];
      return { image: frame.landmarks, world: frame.landmarks };
    };
  }, frames);
};

const openQuickSession = async (page: Page, base: string, { calibration = true } = {}) => {
  await page.goto(`${base}/quick-session`);
  await page.getByText("QUICK SESSION").waitFor();
  const camera = page.getByRole("switch", { name: "Punch camera" });
  if ((await camera.getAttribute("data-state")) !== "checked") await camera.click();
  if (calibration) await skipCalibration(page);
};

const trainAndFinish = async (page: Page) => {
  await playButton(page).click();
  await expect(page.getByTestId("log-live-total")).toHaveText(String(PUNCHES.length), { timeout: 20_000 });
  const lead = Number(await page.getByTestId("log-live-lead").textContent());
  const rear = Number(await page.getByTestId("log-live-rear").textContent());
  expect(lead + rear).toBe(PUNCHES.length);
  await finishSessionButton(page).click();
  await page.getByText("SESSION COMPLETE!").waitFor();
};

const expectSummary = async (page: Page) => {
  await expect(page.getByTestId("log-total")).toHaveText(String(PUNCHES.length));
  await expect(page.getByTestId("log-rounds")).toHaveText("1");
  await expect(page.getByTestId("log-combos")).toHaveText("1");
};

for (const viewport of [{ width: 1366, height: 768 }, { width: 390, height: 844 }]) {
  test(`a guest's punches are logged and kept in this browser at ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await fakeCameraAndPoses(page);
    await finishGuestOnboarding(page, NO_BACKEND_URL, "Log Guest");
    await openQuickSession(page, NO_BACKEND_URL);
    await playButton(page).click();

    await expect(page.getByTestId("log-live-total")).toHaveText(String(PUNCHES.length), { timeout: 20_000 });

    // Everything needed mid-session stays on screen, drawn over the camera picture rather than under it
    const finish = finishSessionButton(page);
    await expect(finish).toBeInViewport();
    const clock = page.getByTestId("run-clock");
    await expect(clock).toBeInViewport();
    const onTop = await clock.evaluate((el) => {
      const box = el.getBoundingClientRect();
      const top = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return !!top && !top.closest('[data-testid="camera-panel"]');
    });
    expect(onTop).toBe(true);
    await expect(page.getByTestId("camera-panel")).toBeVisible();

    await finish.click();
    await page.getByText("SESSION COMPLETE!").waitFor();
    await expectSummary(page);
    await page.getByRole("button", { name: /log/i }).first().click();

    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("get-clocked-history") as string).state.guestHistory[0]);
    expect(saved.punch_log.punches).toHaveLength(PUNCHES.length);
    expect(saved.punch_log.punches[0]).toMatchObject({ hand: "lead", round: 1 });

    await page.goto(`${NO_BACKEND_URL}/history`);
    await page.getByText("Quick Session").first().click();
    await expect(page.getByTestId("log-total")).toHaveText(String(PUNCHES.length));
  });
}

test("a reload mid-session keeps the punches already logged", async ({ page }) => {
  await fakeCameraAndPoses(page);
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Log Reload");
  await openQuickSession(page, NO_BACKEND_URL);
  await playButton(page).click();
  await expect(page.getByTestId("log-live-total")).toHaveText(String(PUNCHES.length), { timeout: 20_000 });
  // The save happens on the second's tick
  await page.waitForTimeout(1500);

  await page.reload();
  await page.getByRole("button", { name: /resume/i }).click();
  await expect(page.getByTestId("log-live-total")).toHaveText(String(PUNCHES.length));
  await playButton(page).click();
  await finishSessionButton(page).click();
  await page.getByText("SESSION COMPLETE!").waitFor();
  await expect(page.getByTestId("log-total")).toHaveText(String(PUNCHES.length));
  await expect(page.getByTestId("log-rounds")).toHaveText("2");
});

test("a camera that never starts logs nothing, and the session still works", async ({ page }) => {
  await page.context().addInitScript(() => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: async () => Promise.reject(new DOMException("no", "NotAllowedError")) },
    });
  });
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Log Denied");
  await openQuickSession(page, NO_BACKEND_URL, { calibration: false });
  await playButton(page).click();
  await page.getByTestId("camera-panel-problem").waitFor();
  await finishSessionButton(page).click();
  await page.getByText("SESSION COMPLETE!").waitFor();
  await expect(page.getByTestId("punch-log")).toHaveCount(0);
});

test("an account's punches go in the database and come back in history", async ({ page }) => {
  await fakeCameraAndPoses(page);
  const email = `punch-log-${Date.now()}@example.com`;
  await requestSignInEmail(page, APP_URL, email);
  await clickNewestEmailLink(page, email);
  await finishAccountOnboarding(page, "Log Account");
  await openQuickSession(page, APP_URL);
  await trainAndFinish(page);
  await expectSummary(page);
  await page.getByRole("button", { name: /log/i }).first().click();

  const userId = await userIdFor(email);
  await expect
    .poll(async () => {
      const { data } = await service.from("workout_history").select("punch_log").eq("user_id", userId);
      return data?.[0]?.punch_log?.punches?.length;
    })
    .toBe(PUNCHES.length);

  // A short session still adds its real punches to the career counts
  const { data: logged } = await service.from("workout_history").select("punch_log").eq("user_id", userId).single();
  const byType = logged?.punch_log.totals.byType;
  await expect
    .poll(async () => {
      const { data } = await service.from("profiles").select("punch_1_count, punch_2_count, punch_3_count, punch_4_count, punch_5_count, punch_6_count").eq("user_id", userId).single();
      return data;
    })
    .toEqual({
      punch_1_count: byType.jab,
      punch_2_count: byType.cross,
      punch_3_count: byType.lead_hook,
      punch_4_count: byType.rear_hook,
      punch_5_count: byType.lead_uppercut,
      punch_6_count: byType.rear_uppercut,
    });

  // The list leaves the logs behind, and opening a session fetches its own
  const historyReads: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("/rest/v1/workout_history")) historyReads.push(decodeURIComponent(request.url()));
  });
  await page.goto(`${APP_URL}/history`);
  await page.getByText("Quick Session").first().click();
  await expect(page.getByTestId("log-total")).toHaveText(String(PUNCHES.length));
  expect(historyReads.filter((url) => url.includes("user_id=")).every((url) => !url.includes("punch_log") && !url.includes("select=*"))).toBe(true);
  expect(historyReads.some((url) => url.includes("select=punch_log"))).toBe(true);
});

const leaveFromTheStage = async (page: Page, choice: string) => {
  await page.getByRole("button", { name: /^Leave/ }).first().click();
  await page.getByRole("button", { name: choice }).click();
  await page.waitForURL((url) => url.pathname === "/");
};

const guestHistory = (page: Page) =>
  page.evaluate(() => JSON.parse(localStorage.getItem("get-clocked-history") ?? "{}").state?.guestHistory ?? []);

test("End & Save from the back button keeps a guest's history and punch log", async ({ page }) => {
  await fakeCameraAndPoses(page);
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Log Leaver");
  await openQuickSession(page, NO_BACKEND_URL);
  await playButton(page).click();
  await expect(page.getByTestId("log-live-total")).toHaveText(String(PUNCHES.length), { timeout: 20_000 });

  await leaveFromTheStage(page, "End & Save");

  await expect.poll(async () => (await guestHistory(page)).length).toBe(1);
  const [saved] = await guestHistory(page);
  expect(saved.workout_name).toBe("Quick Session");
  expect(saved.duration).toBeGreaterThan(0);
  expect(saved.punch_log.punches).toHaveLength(PUNCHES.length);
});

test("Leave Without Saving adds nothing to the history", async ({ page }) => {
  await fakeCameraAndPoses(page);
  await finishGuestOnboarding(page, NO_BACKEND_URL, "Log Walkout");
  await openQuickSession(page, NO_BACKEND_URL);
  await playButton(page).click();
  await expect(page.getByTestId("log-live-total")).toHaveText(String(PUNCHES.length), { timeout: 20_000 });

  await leaveFromTheStage(page, "Leave Without Saving");

  await page.waitForTimeout(500);
  expect(await guestHistory(page)).toHaveLength(0);
});

test("End & Save from the back button puts an account's session and counts in the database", async ({ page }) => {
  await fakeCameraAndPoses(page);
  const email = `punch-leave-${Date.now()}@example.com`;
  await requestSignInEmail(page, APP_URL, email);
  await clickNewestEmailLink(page, email);
  await finishAccountOnboarding(page, "Log Account Leaver");
  await openQuickSession(page, APP_URL);
  await playButton(page).click();
  await expect(page.getByTestId("log-live-total")).toHaveText(String(PUNCHES.length), { timeout: 20_000 });

  await leaveFromTheStage(page, "End & Save");

  const userId = await userIdFor(email);
  await expect
    .poll(async () => {
      const { data } = await service.from("workout_history").select("punch_log").eq("user_id", userId);
      return data?.length === 1 ? data[0].punch_log?.punches?.length : null;
    })
    .toBe(PUNCHES.length);
  // The profile update comes after the history row, from a page that has already gone
  await expect
    .poll(async () => {
      const { data } = await service.from("profiles").select("punch_1_count, punch_2_count, punch_3_count, punch_4_count, punch_5_count, punch_6_count").eq("user_id", userId).single();
      return Object.values(data ?? {}).reduce((sum: number, count) => sum + Number(count ?? 0), 0);
    })
    .toBeGreaterThan(0);
});

test("End & Save on a full workout puts an account's session, punch log and XP in the database", async ({ page }) => {
  await fakeCameraAndPoses(page);
  const email = `workout-leave-${Date.now()}@example.com`;
  await requestSignInEmail(page, APP_URL, email);
  await clickNewestEmailLink(page, email);
  await finishAccountOnboarding(page, "Log Workout Leaver");
  await page.goto(APP_URL);
  await playButton(page).click();
  await page.waitForURL("**/workout/**");
  await skipCalibration(page);
  await playButton(page).click();
  const combo = page.locator(".combo-plate").first();
  for (let i = 0; i < 60 && !(await combo.isVisible()); i++) await page.getByRole("button", { name: "Skip segment" }).click();
  await expect(page.getByTestId("camera-panel-count")).toHaveText(String(PUNCHES.length), { timeout: 30_000 });

  await page.getByRole("button", { name: "Leave workout" }).click();
  await page.getByRole("button", { name: "End & Save" }).click();
  await page.waitForURL((url) => url.pathname === "/");

  const userId = await userIdFor(email);
  await expect
    .poll(async () => {
      const { data } = await service.from("workout_history").select("punch_log, xp_earned, duration").eq("user_id", userId);
      return data?.length === 1 && data[0].xp_earned > 0 && data[0].duration > 0 ? data[0].punch_log?.punches?.length : null;
    })
    .toBe(PUNCHES.length);
  await expect
    .poll(async () => (await service.from("profiles").select("total_xp").eq("user_id", userId).single()).data?.total_xp ?? 0)
    .toBeGreaterThan(0);
});
