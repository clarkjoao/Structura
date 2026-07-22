import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import fs from "fs";
import path from "path";

const BUNDLED_VIRTUAL_ID = "virtual:structura-bundled-plugins";
const BUNDLED_RESOLVED_ID = "\0" + BUNDLED_VIRTUAL_ID;

/**
 * Embeds selected plugins' built IIFE bundles into the app as a "built-in" layer, so a
 * distribution build can ship plugins pre-installed (no manual upload). The plugin list comes
 * from the STRUCTURA_BUNDLED_PLUGINS env var (comma-separated plugin folder names), set by
 * tools/build-with-plugins.mjs after it builds each plugin. Empty when the env var is unset,
 * so `npm run dev` and a plain `npm run build` are unaffected.
 */
function structuraBundledPlugins(): Plugin {
  return {
    name: "structura-bundled-plugins",
    resolveId(id) {
      if (id === BUNDLED_VIRTUAL_ID) return BUNDLED_RESOLVED_ID;
    },
    load(id) {
      if (id !== BUNDLED_RESOLVED_ID) return;
      const selected = (process.env.STRUCTURA_BUNDLED_PLUGINS ?? "")
        .split(",")
        .map((name) => name.trim())
        .filter(Boolean);

      const bundled = selected.map((dir) => {
        const distPath = path.resolve(__dirname, "plugins", dir, "dist", "plugin.js");
        if (!fs.existsSync(distPath)) {
          throw new Error(
            `[structura-bundled-plugins] "${dir}" has no dist/plugin.js at ${distPath}. ` +
              `Build it first, or use \`npm run build:plugins -- ${dir}\`.`,
          );
        }
        return { dir, code: fs.readFileSync(distPath, "utf8") };
      });

      // JSON.stringify safely escapes the IIFE source into a string literal in the app bundle.
      return `export const bundledPlugins = ${JSON.stringify(bundled)};`;
    },
  };
}

export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), structuraBundledPlugins()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    include: ["aws-react-icons", "azure-react-icons"],
  },
}));
