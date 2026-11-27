import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";

/**
 * opscr is a plugin's concern. Its projection (`opscr-mapping`) lives in
 * `plugins/structura-plugin-opscr/src/opscr-mapping`, and the VSCode extension copies it from
 * there; what the app offers opscr is the plugin API (`api.layout` and the rest) and the embed's
 * protocol. Nothing under `src/` may import the projection or the `opscr` package again — that
 * is how the app started to hold one plugin's logic.
 */

const SRC = path.resolve(__dirname, "../..");
const IMPORT = /from\s+["'](?:[^"']*opscr-mapping[^"']*|opscr(?:\/[^"']*)?)["']/;

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sources(full);
    return /\.(ts|tsx)$/.test(entry.name) ? [full] : [];
  });
}

describe("opscr stays in its plugin", () => {
  it("src/ imports neither opscr-mapping nor opscr", () => {
    const offenders = sources(SRC)
      .filter((file) => IMPORT.test(fs.readFileSync(file, "utf8")))
      .map((file) => path.relative(SRC, file));
    expect(offenders).toEqual([]);
  });

  it("the projection is not back in src/lib", () => {
    expect(fs.existsSync(path.join(SRC, "lib", "opscr-mapping"))).toBe(false);
  });
});
