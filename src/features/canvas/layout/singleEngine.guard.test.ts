import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * There is one layout engine: ELK, run by `features/canvas/layout`. The app arranges with it,
 * plugins reach it through `api.layout` (plugin API 1.19), the embed preview through the same
 * implementation, and the VSCode extension through its webview (`STRUCTURA_PLACE`). A second
 * ELK — a copy for a channel that "cannot import the host" — is how the channels started to
 * draw the same diagram differently, so none may come back: ELK is named, imported, configured
 * and depended on only here.
 */

const ROOT = path.resolve(__dirname, "../../../..");
const ENGINE = path.join(ROOT, "src/features/canvas/layout");

/** Every channel's source: the app, the plugins and the extensions. */
const CHANNELS = ["src", "plugins", "extensions"];
const SKIPPED_DIRS = new Set(["node_modules", "dist", "dist-embed", "media", "coverage", ".vite"]);

/** Importing ELK, or configuring it (its option keys are what a hand-rolled copy carries). */
const ELK = /["']elkjs(?:\/[^"']*)?["']|["']elk\.(?:algorithm|direction|edgeRouting)["']/;

function sources(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : sources(full);
    return /\.(ts|tsx|js|mjs|cjs)$/.test(entry.name) ? [full] : [];
  });
}

function manifests(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return SKIPPED_DIRS.has(entry.name) ? [] : manifests(full);
    return entry.name === "package.json" ? [full] : [];
  });
}

describe("one layout engine", () => {
  it("ELK is imported and configured only in features/canvas/layout", () => {
    const offenders = CHANNELS.flatMap((channel) => sources(path.join(ROOT, channel)))
      .filter((file) => !file.startsWith(ENGINE + path.sep))
      .filter((file) => ELK.test(fs.readFileSync(file, "utf8")))
      .map((file) => path.relative(ROOT, file));
    expect(offenders).toEqual([]);
  });

  it("no plugin or extension depends on elkjs: they lay out with the host's engine", () => {
    const offenders = ["plugins", "extensions"]
      .flatMap((channel) => manifests(path.join(ROOT, channel)))
      .filter((file) => {
        const manifest = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
        return ["dependencies", "devDependencies", "peerDependencies"].some((field) => {
          const deps = manifest[field];
          return typeof deps === "object" && deps !== null && "elkjs" in deps;
        });
      })
      .map((file) => path.relative(ROOT, file));
    expect(offenders).toEqual([]);
  });
});
