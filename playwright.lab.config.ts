import path from "path";
import { defineConfig } from "@playwright/test";
import { silentLaunch } from "./tests/e2e/silent";

/** Where the lab's browser test saves its takes, instead of the real angle-tests folder. */
export const LAB_TEST_DIR = path.resolve(".stack-test/angle-lab");
const PORT = 8096;

// `npm run test:lab`: the angle lab on the dev server, with a made-up body for a camera
export default defineConfig({
  testDir: "tests/lab",
  workers: 1,
  retries: 0,
  timeout: 240_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  outputDir: ".stack-test/lab-results",
  use: {
    baseURL: `http://localhost:${PORT}`,
    viewport: { width: 1440, height: 900 },
    trace: "off",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { browserName: "chromium", launchOptions: silentLaunch.chromium } }],
  webServer: {
    command: `npx vite --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/lab/angles`,
    reuseExistingServer: false,
    env: { VITE_E2E_POSE_FEED: "1", ANGLE_LAB_DIR: LAB_TEST_DIR },
  },
});
