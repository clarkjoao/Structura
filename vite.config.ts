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
      // Each entry is "<dir>" or "<dir>:<flag>[:<flag>]" with flags `off` (starts disabled)
      // and `locked` (cannot be disabled), e.g. "structura-plugin-opscr:off,structura-plugin-leanix:locked".
      const selected = (process.env.STRUCTURA_BUNDLED_PLUGINS ?? "")
        .split(",")
        .map((entry) => entry.trim())
        .filter(Boolean)
        .map((entry) => {
          const [dir, ...flags] = entry.split(":");
          return { dir, defaultEnabled: !flags.includes("off"), locked: flags.includes("locked") };
        });

      const bundled = selected.map(({ dir, defaultEnabled, locked }) => {
        const distPath = path.resolve(import.meta.dirname, "plugins", dir, "dist", "plugin.js");
        if (!fs.existsSync(distPath)) {
          throw new Error(
            `[structura-bundled-plugins] "${dir}" has no dist/plugin.js at ${distPath}. ` +
              `Build it first, or use \`npm run build:plugins -- ${dir}\`.`,
          );
        }
        return { dir, code: fs.readFileSync(distPath, "utf8"), defaultEnabled, locked };
      });

      // JSON.stringify safely escapes the IIFE source into a string literal in the app bundle.
      return `export const bundledPlugins = ${JSON.stringify(bundled)};`;
    },
  };
}

/**
 * The locale bundles are separate chunks, imported by `i18n.ts` after the entry has run,
 * which makes their fetch a round trip behind the entry chunk. This hints them from
 * `index.html` instead, so it starts with the entry: an inline script picks the language the
 * way i18n's detector does (stored choice, then the browser's) and adds a `modulepreload` for
 * that locale and for the `pt-BR` fallback. The JSON stays out of the entry chunk. The hashed
 * chunk names are read from the bundle, so they stay right across builds.
 */
function structuraLocalePreload(): Plugin {
  let base = "/";
  return {
    name: "structura-locale-preload",
    apply: "build",
    configResolved(config) {
      base = config.base;
    },
    transformIndexHtml: {
      order: "post",
      handler(_html, ctx) {
        const urls: Record<string, string> = {};
        for (const chunk of Object.values(ctx.bundle ?? {})) {
          if (chunk.type !== "chunk" || !chunk.facadeModuleId) continue;
          const match = /\/i18n\/locales\/([^/]+)\.json$/.exec(chunk.facadeModuleId);
          if (match) urls[match[1]] = base + chunk.fileName;
        }
        if (Object.keys(urls).length === 0) return;
        const script =
          `(function(){var u=${JSON.stringify(urls)},l="pt-BR";try{` +
          `var s=localStorage.getItem("structura_language")||navigator.language||"";` +
          `if(/^en/i.test(s))l="en"}catch(e){}` +
          `[l,"pt-BR"].filter(function(k,i,a){return u[k]&&a.indexOf(k)===i}).forEach(function(k){` +
          `var e=document.createElement("link");e.rel="modulepreload";e.href=u[k];` +
          `document.head.appendChild(e)})})();`;
        return [{ tag: "script", children: script, injectTo: "head-prepend" }];
      },
    },
  };
}

export default defineConfig(() => ({
  base: process.env.VITE_BASE_PATH ?? "/",
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [react(), structuraBundledPlugins(), structuraLocalePreload()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
      // The collaboration wire contract is one file shared with the relay.
      "@collab-protocol": path.resolve(import.meta.dirname, "./server/src/collab/protocol.ts"),
    },
    // Force a single React across transitive deps (@assistant-ui,
    // @radix-ui, etc. each ship their own copy otherwise). Without this,
    // hooks called inside a sub-dependency's component can resolve to a
    // second React instance whose dispatcher is null, crashing the page.
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["aws-react-icons", "azure-react-icons"],
  },
}));
