import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { resolve } from "path";

export default defineConfig({
  plugins: [react()],
  define: {
    "process.env.NODE_ENV": JSON.stringify("production"),
    "process.env.DEBUG": "false",
    "process.env": "{}",
  },
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.tsx"),
      name: "StructuraPluginLeanix",
      fileName: () => "plugin.js",
      formats: ["iife"],
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        globals: {
          react: "__REACT__",
          "react-dom": "__REACT__",
        },
      },
      external: ["react", "react-dom"],
    },
  },
});
