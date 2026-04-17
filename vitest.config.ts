import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    pool: "forks",
    poolOptions: {
      forks: { singleFork: true },
    },
    // Integration + e2e tests spawn subprocesses; default 5s is too tight.
    testTimeout: 20_000,
  },
});
