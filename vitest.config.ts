import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/**/*.test.ts"],
    environment: "node",
    // The emulator is the fixture, so these must not run concurrently.
    fileParallelism: false,
  },
});
