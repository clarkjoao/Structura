import { defineConfig, type Plugin } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

// Resolve the build-only virtual module to an empty list so anything importing the plugin
// registry loads under test. Individual tests override via vi.mock("./bundled-plugins").
function bundledPluginsStub(): Plugin {
  const id = "virtual:structura-bundled-plugins";
  const resolved = "\0" + id;
  return {
    name: "structura-bundled-plugins-stub",
    resolveId: (x) => (x === id ? resolved : undefined),
    load: (x) => (x === resolved ? "export const bundledPlugins = [];" : undefined),
  };
}

export default defineConfig({
  plugins: [react(), bundledPluginsStub()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.tsx"],
    // scripts/: pure helpers of the dev tooling (e.g. the perf:large harness), not the app.
    include: ["src/**/*.{test,spec}.{ts,tsx}", "scripts/**/*.test.ts"],
    testTimeout: 90000,
    // No retries: a retry hides test-isolation bugs (a flaky test passes on the second try).
    retry: 0,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      "@collab-protocol": path.resolve(import.meta.dirname, "./server/src/collab/protocol.ts"),
    },
  },
});
