import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

// React is the host's: externalized and bound to the globals the host installs (see the
// host's runtime-globals.ts), so hooks work across the boundary. opscr/core and elkjs are
// bundled into the IIFE.
export default defineConfig({
  plugins: [react({ jsxRuntime: "automatic" })],
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
