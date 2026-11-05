#!/usr/bin/env node
// Run or build the Structura app with selected plugins pre-installed ("built-in" layer).
//
// Usage:
//   npm run build:plugins                                   (interactive: pick plugins and options)
//   npm run build:plugins -- opscr leanix:off               (leanix ships, but starts disabled)
//   npm run build:plugins -- opscr:locked                   (opscr ships and cannot be disabled)
//   npm run dev:plugins  -- opscr                           (same, but starts the dev server)
//   npm run build:plugins -- --no-build opscr               (reuse existing dist/plugin.js)
//
// A plugin is `<name>[:off][:locked]`; `<name>` may drop the `structura-plugin-` prefix.
//   off     starts disabled for a user who never touched it (they can turn it on)
//   locked  always on: the Plugins page shows the switch but it cannot be turned off
// Also accepted: `--plugins a,b:off`, comma- or space-separated lists, and `--dev`.
//
// It builds each selected plugin (plugins/<name>), then runs the app build (or `vite` with
// --dev) with STRUCTURA_BUNDLED_PLUGINS set so vite.config.ts's `structura-bundled-plugins`
// plugin embeds each dist/plugin.js as a string. Plain `npm run build` / `npm run dev` ship
// zero built-in plugins.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline/promises";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLUGINS_DIR = path.join(ROOT, "plugins");
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";
const PREFIX = "structura-plugin-";

function fail(message) {
  console.error(`\n[build:plugins] ${message}\n`);
  process.exit(1);
}

function available() {
  return fs
    .readdirSync(PLUGINS_DIR, { withFileTypes: true })
    .filter((e) => e.isDirectory() && fs.existsSync(path.join(PLUGINS_DIR, e.name, "package.json")))
    .map((e) => e.name);
}

/** "opscr:off:locked" -> { dir, off, locked }; accepts the name without the prefix. */
function parseSpec(raw) {
  const [name, ...flags] = raw.trim().split(":");
  for (const f of flags)
    if (f !== "off" && f !== "locked")
      fail(`Unknown flag ":${f}" in "${raw}" (use :off or :locked).`);
  const dir = available().find((d) => d === name || d === PREFIX + name);
  if (!dir) fail(`Plugin "${name}" not found in plugins/ (have: ${available().join(", ")}).`);
  return { dir, off: flags.includes("off"), locked: flags.includes("locked") };
}

async function askInteractively() {
  if (!process.stdin.isTTY)
    fail("No plugins given. Example: npm run build:plugins -- opscr leanix:off");
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  const yes = async (q, def) => {
    const a = (await rl.question(`${q} [${def ? "Y/n" : "y/N"}] `)).trim().toLowerCase();
    return a === "" ? def : a.startsWith("y");
  };
  const chosen = [];
  for (const dir of available()) {
    if (!(await yes(`Include ${dir}?`, false))) continue;
    const on = await yes("  Enabled by default?", true);
    const canOff = await yes("  Can the user disable it?", true);
    chosen.push({ dir, off: !on, locked: !canOff });
  }
  rl.close();
  return chosen;
}

// Parse args: `--plugins a,b`, bare positional specs, and comma- or space-separated lists.
const argv = process.argv.slice(2);
let build = true;
let dev = false;
const specs = [];
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === "--no-build") {
    build = false;
  } else if (arg === "--dev") {
    dev = true;
  } else if (arg === "--plugins") {
    const value = argv[++i];
    if (value) specs.push(...value.split(","));
  } else if (arg.startsWith("--plugins=")) {
    specs.push(...arg.slice("--plugins=".length).split(","));
  } else if (arg.startsWith("-")) {
    fail(`Unknown flag "${arg}".`);
  } else {
    specs.push(...arg.split(","));
  }
}

const parsed = specs
  .map((s) => s.trim())
  .filter(Boolean)
  .map(parseSpec);
const selected = parsed.length > 0 ? parsed : await askInteractively();
if (selected.length === 0) fail("No plugins selected.");
// De-duplicate by dir; the last spec wins.
const byDir = new Map(selected.map((p) => [p.dir, p]));
const plugins = [...byDir.keys()];
const envValue = [...byDir.values()]
  .map((p) => [p.dir, p.off && "off", p.locked && "locked"].filter(Boolean).join(":"))
  .join(",");

if (selected.some((p) => p.off && p.locked)) {
  console.warn("[build:plugins] note: a locked plugin is always on, so :off has no effect on it.");
}

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, stdio: "inherit", env: process.env });
  if (result.status !== 0) {
    fail(`\`${cmd} ${args.join(" ")}\` failed (exit ${result.status ?? result.signal}).`);
  }
}

// Plugins externalize react/react-dom (they're build-time devDeps only), so a fresh
// `npm install` can hit spurious ERESOLVE peer conflicts. Prefer `npm ci` when a lockfile
// exists — it installs the locked tree without re-resolving peers — and fall back to
// `npm install --legacy-peer-deps` otherwise.
function installDeps(dir, name) {
  console.log(`[build:plugins] installing deps for ${name}...`);
  if (fs.existsSync(path.join(dir, "package-lock.json"))) {
    const ci = spawnSync(NPM, ["--prefix", dir, "ci"], {
      cwd: ROOT,
      stdio: "inherit",
      env: process.env,
    });
    if (ci.status === 0) return;
    console.warn(
      `[build:plugins] \`npm ci\` failed for ${name}, retrying with --legacy-peer-deps...`,
    );
  }
  run(NPM, ["--prefix", dir, "install", "--legacy-peer-deps"], ROOT);
}

for (const name of plugins) {
  const dir = path.join(PLUGINS_DIR, name);
  if (!fs.existsSync(path.join(dir, "package.json"))) {
    fail(`Plugin "${name}" not found at plugins/${name} (missing package.json).`);
  }

  if (build) {
    if (!fs.existsSync(path.join(dir, "node_modules"))) {
      installDeps(dir, name);
    }
    console.log(`[build:plugins] building ${name}...`);
    run(NPM, ["--prefix", dir, "run", "build"], ROOT);
  }

  if (!fs.existsSync(path.join(dir, "dist", "plugin.js"))) {
    fail(`Plugin "${name}" has no dist/plugin.js. Drop --no-build so it gets built.`);
  }
}

console.log(
  `[build:plugins] ${dev ? "starting dev server" : "building app"} with built-in plugins: ${envValue}`,
);
const app = spawnSync(NPM, ["run", dev ? "dev" : "build"], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, STRUCTURA_BUNDLED_PLUGINS: envValue },
});
process.exit(app.status ?? 1);
