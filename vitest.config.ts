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
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    testTimeout: 90000,
    retry: 2,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
