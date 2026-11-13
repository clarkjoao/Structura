#!/usr/bin/env node
/**
 * Bundle the opscr-architect skill into the plugin, as chat context for bound diagrams.
 *
 * Runs the linked `opscr` package's own generator (`opscr skills build`) into a temp folder —
 * so the skill always matches the schemas the plugin validates with — and writes
 * `src/generated/opscr-skill.ts`: SKILL.md and its references, without the example workspace
 * (the chat gets the user's own manifests instead).
 *
 *   node scripts/build-skill.mjs          # write the generated file
 *   node scripts/build-skill.mjs --check  # fail if it is stale
 */
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const target = resolve(here, "../src/generated/opscr-skill.ts");
const opscrRoot = dirname(createRequire(import.meta.url).resolve("opscr/package.json"));
const cli = join(opscrRoot, "dist/cli/index.js");
if (!existsSync(cli)) {
  console.error(
    `[build-skill] ${cli} not found — build opscr first (npm run build in its checkout).`,
  );
  process.exit(1);
}

const out = mkdtempSync(join(tmpdir(), "opscr-skill-"));
try {
  execFileSync(process.execPath, [cli, "skills", "build", "--out", out], { stdio: "ignore" });
  const walk = (dir) =>
    readdirSync(dir).flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });
  const files = Object.fromEntries(
    walk(out)
      .map((path) => relative(out, path).split("\\").join("/"))
      .filter((rel) => rel.endsWith(".md") && !rel.startsWith("references/example/"))
      .sort()
      .map((rel) => [rel, readFileSync(join(out, rel), "utf8")]),
  );
  const version = JSON.parse(readFileSync(join(opscrRoot, "package.json"), "utf8")).version;
  const source = `/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * The opscr-architect skill of opscr ${version}, bundled via \`npm run build-skill\`.
 */

/** Skill files by path (SKILL.md first, then references). */
export const OPSCR_SKILL: Readonly<Record<string, string>> = ${JSON.stringify(files, null, 2)};
`;
  if (process.argv.includes("--check")) {
    const current = existsSync(target) ? readFileSync(target, "utf8") : "";
    if (current !== source) {
      console.error(
        "[build-skill] src/generated/opscr-skill.ts is stale. Run: npm run build-skill",
      );
      process.exit(1);
    }
    console.log("[build-skill] skill is in sync.");
  } else {
    writeFileSync(target, source);
    console.log(`[build-skill] wrote ${Object.keys(files).length} skill files.`);
  }
} finally {
  rmSync(out, { recursive: true, force: true });
}
