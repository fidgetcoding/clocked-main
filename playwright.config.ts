import { defineConfig } from "@playwright/test";
import { silentLaunch } from "./tests/e2e/silent";

// Run through `npm run test:stack`, which starts the stack and serves both builds of the app
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 90_000,
  expect: { timeout: 10_000 },
  reporter: [["list"]],
  outputDir: ".stack-test/results",
  use: {
    viewport: { width: 390, height: 844 },
    trace: "off",
    screenshot: "only-on-failure",
  },
  // No test may make a sound on the machine running it. See tests/e2e/silent.ts.
  projects: [
    { name: "chromium", use: { browserName: "chromium", launchOptions: silentLaunch.chromium } },
    ...(process.env.STACK_ALL_BROWSERS
      ? [
          { name: "firefox", use: { browserName: "firefox" as const, launchOptions: silentLaunch.firefox } },
          { name: "webkit", use: { browserName: "webkit" as const, launchOptions: silentLaunch.webkit } },
        ]
      : []),
  ],
});
