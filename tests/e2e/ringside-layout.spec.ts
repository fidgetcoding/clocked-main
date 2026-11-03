// Nothing overlaps, clips or scrolls sideways at the sizes people use. Needs only a served build of the app.
// The camera is a canvas stream, so no real camera is ever opened.
import type { Page } from "@playwright/test";
import { expect, test } from "./silent";
import { playButton, skipButton, skipCalibration } from "./controls";

const base = process.env.STACK_NO_BACKEND_URL as string;
const SIZES = [
  { width: 320, height: 568 },
  { width: 390, height: 844 },
  { width: 844, height: 390 },
  { width: 1280, height: 720 },
  { width: 1440, height: 900 },
];

const fakeCamera = () => {
  const canvas = document.createElement("canvas");
  canvas.width = 640;
  canvas.height = 480;
  setInterval(() => canvas.getContext("2d")?.fillRect(0, 0, 640, 480), 100);
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia: async () => canvas.captureStream(5) },
  });
};

const onboard = async (page: Page) => {
  await page.goto(`${base}/onboarding`);
  await page.getByRole("button", { name: "GET STARTED" }).click();
  await page.getByText("I'M A FIGHTER").click();
  await page.getByPlaceholder("Your name").fill("Fit Check");
  const start = page.getByRole("button", { name: "START TRAINING" });
  while (!(await start.isVisible())) await page.getByRole("button", { name: "Continue" }).click();
  await start.click();
  await page.getByText("Your Sets").waitFor();
};

/** The lit readouts lean on a slant. The slant stays inside the readout's own box, and no words sit under it. */
const noSlantSpill = async (page: Page) => {
  const problems = await page.evaluate(() => {
    const found: string[] = [];
    const overlap = (a: DOMRect, b: DOMRect) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
    const words = [...document.querySelectorAll('[data-testid="run-stage"] *, [data-testid="punch-live"] *')].filter((el) => {
      if (el.closest(".lit, .sr-only, [data-testid='camera-asking'], .stage-check, [data-ticker]")) return false;
      if (!(el as HTMLElement).offsetParent) return false;
      return [...el.childNodes].some((node) => node.nodeType === 3 && node.textContent?.trim());
    });
    for (const plate of document.querySelectorAll(".lit-fill")) {
      // getBoundingClientRect includes the skew, so this is the slanted plate's full reach
      const reach = plate.getBoundingClientRect();
      const box = (plate.parentElement as HTMLElement).getBoundingClientRect();
      if (reach.left < box.left - 1 || reach.right > box.right + 1) found.push(`the clock plate leans out of its box by ${Math.round(Math.max(box.left - reach.left, reach.right - box.right))}px`);
      for (const word of words) {
        const range = document.createRange();
        range.selectNodeContents(word);
        for (const line of range.getClientRects()) if (overlap(line, reach)) found.push(`"${word.textContent?.trim().slice(0, 30)}" sits under the clock plate`);
      }
    }
    return found;
  });
  expect(problems).toEqual([]);
};

const noSidewaysScroll = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)).toBeLessThanOrEqual(0);

/** Every control on the stage is on screen, big enough to hit, and not sitting on another one. */
const controlsAreClear = async (page: Page) => {
  const problems = await page.evaluate(() => {
    const boxes = [...document.querySelectorAll('[data-testid="run-stage"] button, [data-testid="run-clock"]')]
      .filter((el) => (el as HTMLElement).offsetParent !== null)
      .map((el) => ({ name: el.getAttribute("aria-label") || el.textContent || el.getAttribute("data-testid"), tag: el.tagName, box: el.getBoundingClientRect() }));
    const found: string[] = [];
    for (const { name, tag, box } of boxes) {
      if (box.left < 0 || box.top < 0 || box.right > innerWidth || box.bottom > innerHeight) found.push(`${name} is off screen`);
      if (tag === "BUTTON" && box.height < 44) found.push(`${name} is only ${box.height}px tall`);
    }
    boxes.forEach((a, i) =>
      boxes.slice(i + 1).forEach((b) => {
        const overlap = a.box.left < b.box.right - 1 && b.box.left < a.box.right - 1 && a.box.top < b.box.bottom - 1 && b.box.top < a.box.bottom - 1;
        if (overlap) found.push(`${a.name} overlaps ${b.name}`);
      }),
    );
    return found;
  });
  expect(problems).toEqual([]);
};

for (const viewport of SIZES) {
  const size = `${viewport.width}x${viewport.height}`;

  for (const camera of [false, true]) {
    test(`the run screen fits at ${size}, camera ${camera ? "on" : "off"}`, async ({ page }) => {
      await page.setViewportSize(viewport);
      await page.addInitScript(fakeCamera);
      await onboard(page);
      await page.evaluate((on) => {
        localStorage.setItem(
          "get-clocked-punch-prefs",
          JSON.stringify({ state: { roundSeconds: 0, voiceCues: false, quickSessionCamera: on, workoutCamera: on }, version: 0 }),
        );
      }, camera);
      await page.goto(base);
      await playButton(page).click();
      await page.waitForURL("**/workout/**");
      if (camera) {
        // Calibration opens first, fully on screen, with its buttons big enough to hit
        const calibration = page.getByTestId("calibration");
        await expect(calibration).toBeVisible({ timeout: 30_000 });
        const box = (await calibration.boundingBox())!;
        expect(box.x).toBeGreaterThanOrEqual(0);
        expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
        expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
        for (const button of await calibration.getByRole("button").all()) expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
        await noSidewaysScroll(page);
        await skipCalibration(page);
      }
      await controlsAreClear(page);
      await playButton(page).click();
      await expect(page.getByTestId("run-stage")).toHaveAttribute("data-camera", camera ? "on" : "off");
      await controlsAreClear(page);
      await noSlantSpill(page);
      await noSidewaysScroll(page);

      const combo = page.locator(".combo-plate").first();
      for (let i = 0; i < 60 && !(await combo.isVisible()); i++) await skipButton(page).click();
      await expect(combo).toBeVisible();
      await controlsAreClear(page);
      // Numerals you can read from back there, not slivers
      const plate = await page.locator(".combo-plate").first().boundingBox();
      expect(plate?.height ?? 0).toBeGreaterThanOrEqual(56);
      // The panel stops short of the controls and holds everything it has
      if (camera && viewport.height > 500) {
        const panel = page.getByTestId("free-panel");
        const box = await panel.boundingBox();
        const pause = await page.getByRole("button", { name: "Pause", exact: true }).boundingBox();
        if (viewport.width < 500) expect((box?.y ?? 0) + (box?.height ?? 0)).toBeLessThanOrEqual(pause?.y ?? 0);
        expect(await panel.evaluate((el) => el.scrollHeight - el.clientHeight)).toBeLessThanOrEqual(1);
      }
      await noSidewaysScroll(page);
    });
  }

  test(`the main screens don't scroll sideways at ${size}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    await onboard(page);
    await noSidewaysScroll(page);
    for (const route of ["/stats", "/gloves", "/profile", "/edit-profile", "/settings", "/history", "/fight-club", "/build", "/punch-check", "/quick-session", "/nowhere"]) {
      await page.goto(`${base}${route}`);
      await page.waitForLoadState("networkidle");
      await noSidewaysScroll(page);
      const small = await page.evaluate(() =>
        [...document.querySelectorAll("button")]
          .filter((el) => el.offsetParent !== null && el.getBoundingClientRect().height < 44 && !el.closest("[data-small-ok]"))
          .map((el) => el.getAttribute("aria-label") || el.textContent),
      );
      expect(small, `tap targets on ${route}`).toEqual([]);
    }
  });
}
