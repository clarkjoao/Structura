#!/usr/bin/env node
/**
 * Copies the host's embeddable preview build (`npm run build:embed` at the repo root →
 * dist-embed/) into media/embed/, which the webview loads. Fails when the build is missing.
 */
import { cpSync, existsSync, rmSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const source = resolve(here, "../../../dist-embed");
const target = resolve(here, "../media/embed");

if (!existsSync(resolve(source, "embed.html"))) {
  console.error(
    "[copy-embed] dist-embed/ not found. Run `npm run build:embed` at the repo root first.",
  );
  process.exit(1);
}
rmSync(target, { recursive: true, force: true });
cpSync(source, target, { recursive: true });
console.log("[copy-embed] copied dist-embed → media/embed");
