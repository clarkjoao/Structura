import { defineConfig } from "vitest/config";

export default defineConfig({
  environment: "node",
  include: ["src/**/*.test.ts"],
  testTimeout: 60_000,
});
