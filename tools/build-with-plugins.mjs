#!/usr/bin/env node
// Build the Structura app with selected plugins pre-installed ("built-in" layer).
//
// Usage:
//   npm run build:plugins -- structura-plugin-leanix
//   npm run build:plugins -- --plugins structura-plugin-leanix,structura-plugin-example-ui
//   npm run build:plugins -- --no-build structura-plugin-leanix   (reuse existing dist/plugin.js)
//
// It builds each selected plugin (plugins/<name>), then runs the app build with
// STRUCTURA_BUNDLED_PLUGINS set so vite.config.ts's `structura-bundled-plugins` plugin embeds
// each dist/plugin.js as a string. Plain `npm run build` (no env) ships zero built-in plugins.

import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const PLUGINS_DIR = path.join(ROOT, "plugins");
const NPM = process.platform === "win32" ? "npm.cmd" : "npm";

function fail(message) {
  console.error(`\n[build:plugins] ${message}\n`);
  process.exit(1);
}

// Parse args: `--plugins a,b`, bare positional names, and comma- or space-separated lists.
const argv = process.argv.slice(2);
let build = true;
const names = [];
for (let i = 0; i < argv.length; i++) {
  const arg = argv[i];
  if (arg === "--no-build") {
    build = false;
  } else if (arg === "--plugins") {
    const value = argv[++i];
    if (value) names.push(...value.split(","));
  } else if (arg.startsWith("--plugins=")) {
    names.push(...arg.slice("--plugins=".length).split(","));
  } else if (arg.startsWith("-")) {
    fail(`Unknown flag "${arg}".`);
  } else {
    names.push(...arg.split(","));
  }
}

const plugins = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
if (plugins.length === 0) {
  fail("No plugins given. Example: npm run build:plugins -- structura-plugin-leanix");
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

console.log(`[build:plugins] building app with built-in plugins: ${plugins.join(", ")}`);
const appBuild = spawnSync(NPM, ["run", "build"], {
  cwd: ROOT,
  stdio: "inherit",
  env: { ...process.env, STRUCTURA_BUNDLED_PLUGINS: plugins.join(",") },
});
process.exit(appBuild.status ?? 1);
