// The angle lab end to end on the dev server: a canvas for a camera and a made-up body that throws whatever
// the screen asks for. Proves the flow, saving and scoring, not how well a real person is read.
import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import type { Page } from "@playwright/test";
import { simulate, type SynthPunch } from "../../src/test/punchSynth";
import { LAB_TEST_DIR } from "../../playwright.lab.config";
import { expect, spokenWords, test } from "../e2e/silent";

declare global {
  interface Window {
    __e2ePoseFeed?: (timestampMs: number) => { image: unknown; world: unknown };
  }
}

const SHAPES: Record<string, Pick<SynthPunch, "hand" | "shape">> = {
  jab: { hand: "lead", shape: "straight" },
  cross: { hand: "rear", shape: "straight" },
  lead_hook: { hand: "lead", shape: "hook" },
  rear_hook: { hand: "rear", shape: "hook" },
  lead_uppercut: { hand: "lead", shape: "uppercut" },
  rear_uppercut: { hand: "rear", shape: "uppercut" },
};

const fakeBody = async (page: Page) => {
  const throws = Object.fromEntries(
    Object.entries(SHAPES).map(([punch, shape]) => [punch, simulate({ startMs: 0, durationMs: 1200, punches: [{ ...shape, at: 150 }] }).map((frame) => frame.landmarks)]),
  );
  const guard = simulate({ startMs: 0, durationMs: 0 })[0].landmarks;
  await page.context().addInitScript(
    ({ throws, guard }) => {
      const canvas = document.createElement("canvas");
      canvas.width = 640;
      canvas.height = 480;
      const context = canvas.getContext("2d") as CanvasRenderingContext2D;
      let tick = 0;
      setInterval(() => {
        context.fillStyle = `rgb(${tick++ % 255}, 120, 120)`;
        context.fillRect(0, 0, 640, 480);
      }, 33);
      Object.defineProperty(navigator, "mediaDevices", { configurable: true, value: { getUserMedia: async () => canvas.captureStream(30) } });

      type Point = { x: number; y: number; z: number; visibility?: number };
      const toImage = (points: Point[]) => points.map((p) => ({ x: 0.5 + p.x * 0.5, y: 0.5 + p.y * 0.5, z: p.z, visibility: p.visibility ?? 1 }));
      let startedAt = -Infinity;
      let playing: Point[][] | null = null;
      // Throws the asked-for punch again and again while a step is recording, like someone on the count
      window.__e2ePoseFeed = (timestampMs: number) => {
        const lab = document.querySelector('[data-testid="angle-lab"]');
        const label = lab?.getAttribute("data-step-label") ?? "";
        const recording = lab?.getAttribute("data-stage") === "recording";
        const moves = (throws as Record<string, Point[][]>)[label];
        if (recording && moves && timestampMs - startedAt > 1300) {
          playing = moves;
          startedAt = timestampMs;
        }
        let world = guard as Point[];
        if (playing) {
          const frame = Math.floor((timestampMs - startedAt) / (1000 / 30));
          if (frame < playing.length) world = playing[frame];
          else playing = null;
        }
        return { image: toImage(world), world };
      };
    },
    { throws, guard },
  );
};

const today = () => new Date().toLocaleDateString("en-CA");

test("films spots, saves each take and its score, keeps a grid summary, and carries on after a reload", async ({ page }) => {
  rmSync(LAB_TEST_DIR, { recursive: true, force: true });
  await fakeBody(page);
  await page.goto("/lab/angles?quick=1");
  const lab = page.getByTestId("angle-lab");

  await page.getByRole("button", { name: "Orthodox" }).click();
  await expect(lab).toHaveAttribute("data-phase", "spot");
  await expect(lab).toHaveAttribute("data-spot", "1");
  await expect(page.getByTestId("spot-screen")).toContainText("Laptop diagonal, in front of you on your LEFT");
  await expect(page.getByTestId("spot-screen")).toContainText("On the FLOOR");
  await page.screenshot({ path: ".stack-test/lab-results/spot-1.png" });

  // Spot 1 from the space bar, as from across the room
  await page.keyboard.press("Space");
  await expect(lab).toHaveAttribute("data-phase", "running");
  await expect(lab).toHaveAttribute("data-phase", "scored", { timeout: 90_000 });
  await expect(page.getByTestId("spot-score")).toContainText("Counted");
  const folder = join(LAB_TEST_DIR, today());
  const first = join(folder, "01-front-left-floor-orthodox.json");
  await expect(page.getByTestId("saved-path")).toContainText(first);
  await page.screenshot({ path: ".stack-test/lab-results/score-1.png" });

  const saved = JSON.parse(readFileSync(first, "utf8"));
  expect(saved.format).toBe("clocked-punch-landmarks");
  // The short run: guard and 3 of each punch
  expect(saved.segments).toHaveLength(7);
  expect(saved.segments[1].expected).toBe(3);
  expect(saved.lab.score.counted).toBeGreaterThan(0);
  expect(saved.lab.score.right).toBeGreaterThan(0);
  expect(saved.lab.camera.says).toBeTruthy();

  // Spot 2 is the next point round, with a mouse click this time: the countdown starts at once
  await page.getByRole("button", { name: /Next spot/ }).click();
  await expect(lab).toHaveAttribute("data-spot", "2");
  await expect(page.getByTestId("spot-screen")).toContainText("Move the laptop.");
  await page.getByRole("button", { name: /Ready/ }).click();
  await expect(lab).toHaveAttribute("data-stage", "countdown");
  await expect(lab).toHaveAttribute("data-phase", "scored", { timeout: 90_000 });
  expect(existsSync(join(folder, "02-left-floor-orthodox.json"))).toBe(true);

  const summary = readFileSync(join(folder, "summary.md"), "utf8");
  expect(summary).toContain("| Position | Floor | Chair | All heights |");
  expect(summary).toMatch(/\| Front-left \(10:30\) \| \d+ of \d+ · \d+% · \d+% · \d+ \| – \|/);
  expect(summary).toMatch(/\| Left \(9 o'clock\) \| \d+ of \d+ · \d+% · \d+% · \d+ \| – \|/);
  await expect(page.locator('[data-spot-state="done"]')).toHaveCount(2);

  // Skip spot 3, then stop for the day mid-take
  await page.keyboard.press("Space");
  await expect(lab).toHaveAttribute("data-spot", "3");
  await page.keyboard.press("s");
  await expect(lab).toHaveAttribute("data-spot", "4");
  await page.getByRole("button", { name: /Ready/ }).click();
  await page.getByRole("button", { name: /Pause/ }).click();
  await expect(lab).toHaveAttribute("data-phase", "paused");

  const spoken = await spokenWords(page);
  expect(spoken.some((line) => line.startsWith("Spot 1. Front-left, floor."))).toBe(true);
  expect(spoken.some((line) => line.startsWith("Saved. Counted"))).toBe(true);

  // A later sitting carries on at spot 4, with 2 done and 3 skipped
  await page.reload();
  await expect(page.getByTestId("welcome-screen")).toContainText("Carry on: 2 of 18 spots filmed, orthodox.");
  await page.getByRole("button", { name: "Carry on" }).click();
  await expect(lab).toHaveAttribute("data-spot", "4");
  await expect(page.locator('[data-spot-state="done"]')).toHaveCount(2);
  await expect(page.locator('[data-spot-state="skipped"]')).toHaveCount(1);
  await page.screenshot({ path: ".stack-test/lab-results/spot-4.png" });
});
