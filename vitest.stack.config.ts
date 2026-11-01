import { defineConfig } from "vitest/config";

// Run through `npm run test:stack`, which starts the local stack these tests talk to
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/stack/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 60000,
  },
});
