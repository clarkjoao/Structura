import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.jsx"),
      name: "StructuraPluginExampleUI",
      fileName: "plugin",
      formats: ["iife"]
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
      },
      // Externalize React - use the host's React
      external: ['react', 'react-dom']
    }
  }
});
