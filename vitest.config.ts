import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.{test,spec}.{ts,tsx}"],
    /** Stress tests seed hundreds of components per case; failures should still surface within this bound. */
    testTimeout: 90_000,
    /** Reduces flaky timing benchmarks on slow CI runners. */
    retry: 2,
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./src") },
  },
});
