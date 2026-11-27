import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// React is the host's: externalized and bound to the globals the host installs (see the
// host's runtime-globals.ts), so hooks work across the boundary. opscr/core is bundled
// into the IIFE; layout is the host's engine (`api.layout`), not bundled.
export default defineConfig({
  plugins: [react({ jsxRuntime: "automatic" })],
  // Tests lay out with the host's engine, as the app does (`test/host-layout.setup.ts`); the
  // host's sources import through `@`. The bundle never imports the host.
  test: {
    // The host's own environment: `api.layout.place` builds and sizes elements through the
    // host's element registry, which boots with the app (DOM, i18n) — as it does in the app.
    environment: "jsdom",
    setupFiles: ["./test/host-layout.setup.ts"],
    // The host's element registry (`test/host-layout.setup.ts`) pulls in what the app's aliases name.
    alias: {
      "@": resolve(__dirname, "../../src"),
      "@collab-protocol": resolve(__dirname, "../../server/src/collab/protocol.ts"),
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.tsx"),
      name: "StructuraPluginOpscr",
      fileName: () => "plugin.js",
      formats: ["iife"],
    },
    rollupOptions: {
      external: ["react", "react/jsx-runtime", "react/jsx-dev-runtime"],
      output: {
        inlineDynamicImports: true,
        globals: {
          react: "__REACT__",
          "react/jsx-runtime": "__REACT_JSX_RUNTIME__",
          "react/jsx-dev-runtime": "__REACT_JSX_DEV_RUNTIME__",
        },
      },
    },
  },
});
