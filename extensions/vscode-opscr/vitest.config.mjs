import { defineConfig } from "vitest/config";

// Own config, so vitest does not pick up the app's (jsdom, app setup file) from the repo root.
export default defineConfig({
  test: { environment: "node", globals: true, include: ["src/**/*.test.ts"], testTimeout: 30000 },
});
