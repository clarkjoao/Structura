import { defineConfig, mergeConfig, type Plugin, type UserConfig } from "vite";
import path from "path";
import appConfig from "./vite.config";

/** Swaps the Monaco wrapper for a plain-text stand-in: the preview never edits code. */
function withoutMonaco(): Plugin {
  const stub = path.resolve(import.meta.dirname, "src/embed/NoMonacoEditor.tsx");
  return {
    name: "structura-embed-without-monaco",
    enforce: "pre",
    resolveId(id) {
      if (/(^|\/)lib\/monaco\/LazyMonacoEditor(\.tsx)?$/.test(id)) return stub;
    },
  };
}

/**
 * The embeddable preview (`embed.html`) and editor (`embed-editor.html`) → `dist-embed/`: their own entries, relative asset
 * paths — hosts such as a VSCode webview serve it from a base unknown at build time — no
 * public files and no Monaco. Everything else is the app's configuration.
 */
export default defineConfig((env) =>
  mergeConfig(appConfig(env) as UserConfig, {
    base: "./",
    publicDir: false,
    plugins: [withoutMonaco()],
    build: {
      outDir: "dist-embed",
      emptyOutDir: true,
      rollupOptions: {
        input: {
          embed: path.resolve(import.meta.dirname, "embed.html"),
          "embed-editor": path.resolve(import.meta.dirname, "embed-editor.html"),
        },
      },
    },
  }),
);
