// What a person would notice, as a test: any console error, page error, failed request, blank screen,
// stuck spinner, button out of reach or two buttons on top of each other. Nothing here touches the app.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";

export const SIZES = {
  smallPhone: { width: 320, height: 568 },
  phone: { width: 390, height: 844 },
  proppedPhone: { width: 844, height: 390 },
  laptop: { width: 1280, height: 720 },
  desktop: { width: 1440, height: 800 },
} as const;

// A screen of one flat colour compresses to almost nothing, whichever colour it is
const BLANK_SCREEN_BYTES = 4000;
const SPINNER_PATIENCE_MS = 8000;
const SHOTS = process.env.WALK_SHOTS || ".stack-test/walk-shots";

export interface Person {
  page: Page;
  problems: string[];
  /** Expected noise for this stretch, like the failed requests of being offline on purpose. */
  allow: (pattern: RegExp) => void;
  look: (name: string) => Promise<void>;
}

/** Every visible control in reach: only those in the open dialog when one is up. */
const layoutProblems = (page: Page) =>
  page.evaluate(() => {
    const found: string[] = [];
    const isVisible = (el: Element) => {
      const box = el.getBoundingClientRect();
      const style = getComputedStyle(el);
      return box.width > 0 && box.height > 0 && style.visibility !== "hidden" && style.display !== "none" && Number(style.opacity) > 0.01;
    };
    // Page content passes under a pinned bar as it scrolls, and that's not a collision
    const pinned = (el: Element) => {
      for (let at: Element | null = el; at; at = at.parentElement) {
        if (["fixed", "sticky"].includes(getComputedStyle(at).position)) return true;
      }
      return false;
    };
    const label = (el: Element) => (el.getAttribute("aria-label") || el.textContent || el.tagName).trim().slice(0, 40);
    const root = document.querySelector('[role="alertdialog"],[role="dialog"]') ?? document.body;
    const controls = [...root.querySelectorAll('button,a[href],input:not([type="hidden"]),textarea,select,[role="button"]')].filter(isVisible);
    const wide = document.documentElement.scrollWidth - window.innerWidth;
    if (wide > 1) found.push(`page scrolls sideways by ${wide}px`);
    const inView = controls.filter((el) => {
      const box = el.getBoundingClientRect();
      return box.bottom > 0 && box.top < window.innerHeight;
    });
    for (const el of inView) {
      const box = el.getBoundingClientRect();
      if (box.left < -1 || box.right > window.innerWidth + 1) {
        const clipped = el.closest('[class*="overflow-x"],[class*="overflow-auto"],[class*="overflow-hidden"]');
        if (!clipped) found.push(`"${label(el)}" runs off the side of the screen`);
      }
      if (box.top >= 0 && box.bottom <= window.innerHeight) {
        const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
        if (hit && !el.contains(hit) && !hit.contains(el) && pinned(hit) === pinned(el)) found.push(`"${label(el)}" is covered by "${label(hit)}"`);
      }
    }
    for (let i = 0; i < inView.length; i++) {
      for (let j = i + 1; j < inView.length; j++) {
        const [a, b] = [inView[i], inView[j]];
        if (a.contains(b) || b.contains(a) || pinned(a) !== pinned(b)) continue;
        const [p, q] = [a.getBoundingClientRect(), b.getBoundingClientRect()];
        const x = Math.min(p.right, q.right) - Math.max(p.left, q.left);
        const y = Math.min(p.bottom, q.bottom) - Math.max(p.top, q.top);
        // A mic button set into the corner of a text box is meant to sit there
        const field = [a, b].find((el) => /^(INPUT|TEXTAREA)$/.test(el.tagName));
        const other = field === a ? q : p;
        const host = field?.getBoundingClientRect();
        if (host && other.left >= host.left - 1 && other.right <= host.right + 1 && other.top >= host.top - 1 && other.bottom <= host.bottom + 1) continue;
        if (x > 2 && y > 2) found.push(`"${label(a)}" overlaps "${label(b)}"`);
      }
    }
    return found;
  });

const isSpinning = (page: Page) =>
  page.evaluate(() => {
    if (document.querySelector(".animate-spin")) return true;
    return /^(loading|saving|calculating results)[.…]*$/i.test(document.body.innerText.trim());
  });

export function watch(page: Page, label: string): Person {
  const problems: string[] = [];
  // The app's own camera question holds the screen until the browser answers, which is its design
  const allowed: RegExp[] = [/is covered by "Allow your camera/];
  const note = (what: string) => {
    if (!allowed.some((pattern) => pattern.test(what))) problems.push(`[${page.url().replace(/^https?:\/\/[^/]+/, "")}] ${what}`);
  };
  const pending = new Set<unknown>();
  inFlight.set(page, pending);
  page.on("request", (request) => pending.add(request));
  page.on("requestfinished", (request) => pending.delete(request));
  page.on("requestfailed", (request) => pending.delete(request));
  page.on("console", (message) => {
    if (message.type() === "error") note(`console error: ${message.text().slice(0, 300)}`);
  });
  page.on("pageerror", (error) => note(`page error: ${error.message.slice(0, 300)}`));
  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "";
    // Leaving a page cancels what it was still fetching. A person never sees that.
    if (!/ABORTED|cancelled|Load request cancelled|NS_BINDING_ABORTED/i.test(failure)) note(`request failed: ${request.url().slice(0, 150)} ${failure}`);
  });
  page.on("response", (response) => {
    if (response.status() >= 400) note(`HTTP ${response.status()}: ${response.url().slice(0, 150)}`);
  });

  const dir = join(SHOTS, label);
  mkdirSync(dir, { recursive: true });
  let shot = 0;

  return {
    page,
    problems,
    allow: (pattern) => allowed.push(pattern),
    look: async (name) => {
      await page.waitForTimeout(350);
      const started = Date.now();
      while ((await isSpinning(page)) && Date.now() - started < SPINNER_PATIENCE_MS) await page.waitForTimeout(250);
      if (await isSpinning(page)) note(`${name}: still spinning after ${SPINNER_PATIENCE_MS / 1000}s`);
      const image = await page.screenshot();
      shot += 1;
      writeFileSync(join(dir, `${String(shot).padStart(2, "0")}-${name.replace(/[^a-z0-9]+/gi, "-")}.png`), image);
      if (image.length < BLANK_SCREEN_BYTES) note(`${name}: blank screen`);
      for (const problem of await layoutProblems(page)) note(`${name}: ${problem}`);
      // Scrolled all the way down, the last thing on the page has to clear the bottom bar
      const hidden = await page.evaluate(() => {
        const scroller = document.scrollingElement;
        if (!scroller || scroller.scrollHeight <= window.innerHeight || document.querySelector('[role="alertdialog"],[role="dialog"]')) return [];
        const before = scroller.scrollTop;
        scroller.scrollTop = scroller.scrollHeight;
        const blocked = [...document.querySelectorAll("main button,main a[href]")].filter((el) => {
          const box = el.getBoundingClientRect();
          if (box.height === 0 || box.bottom <= 0 || box.top >= window.innerHeight) return false;
          const hit = document.elementFromPoint(box.left + box.width / 2, Math.min(box.top + box.height / 2, window.innerHeight - 1));
          return hit && !el.contains(hit) && !hit.contains(el) && !hit.closest("main");
        }).map((el) => (el.textContent || el.getAttribute("aria-label") || "").trim().slice(0, 40));
        scroller.scrollTop = before;
        return blocked;
      });
      for (const blocked of hidden) note(`${name}: "${blocked}" can't be scrolled clear of the bottom bar`);
    },
  };
}

const inFlight = new WeakMap<Page, Set<unknown>>();

/** Wait until the page has had nothing in flight for half a second, as a person waits for a screen to settle. */
export async function settle(page: Page): Promise<void> {
  const pending = inFlight.get(page);
  if (!pending) return;
  let quietSince = Date.now();
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    if (pending.size > 0) quietSince = Date.now();
    else if (Date.now() - quietSince >= 500) return;
    await page.waitForTimeout(100);
  }
}

/**
 * Typing an address while the page is still fetching cancels those fetches, and WebKit and Firefox
 * report each one as an error. A person lets the screen settle first.
 */
export async function visit(page: Page, url: string): Promise<void> {
  await settle(page);
  await page.goto(url);
}
