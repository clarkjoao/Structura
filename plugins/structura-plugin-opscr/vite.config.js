import { defineConfig } from "vite";
import { resolve } from "path";

// No React: an importer has no UI. opscr/core and elkjs are bundled into the IIFE, so the
// plugin runs with nothing but the host's StructuraPlugin global.
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      name: "StructuraPluginOpscr",
      fileName: () => "plugin.js",
      formats: ["iife"],
    },
    rollupOptions: {
      output: { inlineDynamicImports: true },
    },
  },
});
