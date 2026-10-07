// SPIKE: builds only the preview entry, with relative asset paths (a webview serves files
// from an arbitrary base).
import { defineConfig, mergeConfig } from "vite";
import base from "../../vite.config";
import path from "path";

export default defineConfig((env) =>
  mergeConfig(typeof base === "function" ? base(env) : base, {
    root: path.resolve(import.meta.dirname),
    base: "./",
    build: {
      outDir: path.resolve(import.meta.dirname, "dist"),
      emptyOutDir: true,
      minify: process.env.SPIKE_MINIFY !== "0",
      rollupOptions: { input: path.resolve(import.meta.dirname, "embed.html") },
    },
  }),
);
