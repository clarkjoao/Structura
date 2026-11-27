import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

const here = fileURLToPath(new URL(".", import.meta.url));

// Own config, so vitest does not pick up the app's (jsdom, app setup file) from the repo root.
// Tests lay out with the host's engine, as the preview does (`test/host-layout.setup.ts`); the
// host's sources import through `@`. The bundle never imports the host.
export default defineConfig({
  test: {
    // The host's environment: its placement boots the element registry (DOM, i18n), as in the
    // webview. The extension's own code needs nothing of it.
    environment: "jsdom",
    globals: true,
    include: ["src/**/*.test.ts"],
    testTimeout: 30000,
    setupFiles: ["./test/host-layout.setup.ts"],
    alias: {
      "@": resolve(here, "../../src"),
      "@collab-protocol": resolve(here, "../../server/src/collab/protocol.ts"),
    },
  },
});
