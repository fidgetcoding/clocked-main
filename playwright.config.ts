import { defineConfig } from "@playwright/test";

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
    browserName: "chromium",
    viewport: { width: 390, height: 844 },
    trace: "off",
    screenshot: "only-on-failure",
  },
});
