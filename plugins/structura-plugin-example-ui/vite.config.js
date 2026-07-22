import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// The host shares its single React instance as globals (see the host's runtime-globals.ts).
// We externalize react + the automatic JSX runtime and bind them to those globals, so the
// plugin reuses the host React (hooks work across the boundary) and writes ordinary React:
//   import { useState } from "react";  and JSX with the automatic runtime — no getReact().
export default defineConfig({
  plugins: [react({ jsxRuntime: "automatic" })],
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.tsx"),
      name: "StructuraPluginExampleUI",
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
