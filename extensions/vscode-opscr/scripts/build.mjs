#!/usr/bin/env node
// Bundles the extension host (Node, CommonJS) — opscr/core, the synced libraries and ELK
// included; `vscode` is provided by the editor.
import { build } from "esbuild";

await build({
  entryPoints: ["src/extension.ts"],
  bundle: true,
  platform: "node",
  format: "cjs",
  target: "node20",
  external: ["vscode"],
  outfile: "dist/extension.js",
  sourcemap: true,
  logLevel: "info",
});
