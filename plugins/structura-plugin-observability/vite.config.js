import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// React and the UI kit come from the host as globals (the host's runtime-globals.ts), so the
// bundle carries only this plugin's code: `import { Button } from "@structura/ui"` binds to
// `__STRUCTURA_UI__`, the same components the app renders.
export default defineConfig({
  plugins: [react({ jsxRuntime: "automatic" })],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.tsx"),
      name: "StructuraPluginObservability",
      fileName: () => "plugin.js",
      formats: ["iife"],
    },
    rollupOptions: {
      external: ["react", "react/jsx-runtime", "react/jsx-dev-runtime", "@structura/ui"],
      output: {
        inlineDynamicImports: true,
        globals: {
          react: "__REACT__",
          "react/jsx-runtime": "__REACT_JSX_RUNTIME__",
          "react/jsx-dev-runtime": "__REACT_JSX_DEV_RUNTIME__",
          "@structura/ui": "__STRUCTURA_UI__",
        },
      },
    },
  },
});
