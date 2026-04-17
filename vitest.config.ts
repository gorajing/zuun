import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    pool: "forks",
    // Vitest 4 moved pool-specific config to top-level under `test` (was `poolOptions.forks` in v3).
    forks: { singleFork: true },
    // Integration + e2e tests spawn subprocesses; default 5s is too tight.
    testTimeout: 20_000,
  },
});
