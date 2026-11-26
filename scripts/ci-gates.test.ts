// Meta-tests: the CI gates must check something. Reads config files only (no tsc run, no network).
//
// Regressions locked:
//  - bac0981b / fbff9f70: the root `typecheck` compiled an empty program and passed over a broken tree.
//  - c5c03f6d: the plugins stopped type-checking / building without anyone noticing.
//  - the observability plugin was missing from the CI plugins job.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import ts from "typescript";
import yaml from "js-yaml";

const root = path.resolve(import.meta.dirname, "..");
const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");

// Needs the private opscr package; the dedicated `opscr` CI job covers it.
const PLUGINS_JOB_EXCEPTIONS = ["structura-plugin-opscr"];

function resolveProject(file: string): string[] {
  const cfgPath = path.join(root, file);
  const raw = ts.readConfigFile(cfgPath, ts.sys.readFile);
  expect(raw.error, `${file} parses`).toBeUndefined();
  return ts.parseJsonConfigFileContent(raw.config, ts.sys, root, undefined, cfgPath).fileNames;
}

function findFiles(dir: string, name: RegExp, out: string[] = []): string[] {
  for (const e of fs.readdirSync(path.join(root, dir), { withFileTypes: true })) {
    if (e.name === "node_modules" || e.name.startsWith(".")) continue;
    const rel = `${dir}/${e.name}`;
    if (e.isDirectory()) findFiles(rel, name, out);
    else if (name.test(e.name)) out.push(rel);
  }
  return out;
}

const pkg = JSON.parse(read("package.json")) as { scripts: Record<string, string> };

describe("typecheck gate", () => {
  it("the app project resolves the source tree, not an empty program", () => {
    const files = resolveProject("tsconfig.json").map((f) => path.relative(root, f));
    expect(files.length).toBeGreaterThan(500);
    expect(files).toContain("src/main.tsx");
  });

  it("the node project includes the vite configs", () => {
    const files = resolveProject("tsconfig.node.json").map((f) => path.relative(root, f));
    expect(files).toContain("vite.config.ts");
  });

  it("`typecheck` runs both projects", () => {
    const script = pkg.scripts.typecheck;
    expect(script).toMatch(/tsc -p tsconfig\.json\b/);
    expect(script).toMatch(/tsc -p tsconfig\.node\.json\b/);
  });
});

describe("plugins:sync-check", () => {
  const script = pkg.scripts["plugins:sync-check"];
  const syncScripts = [
    ...findFiles("plugins", /^sync-(types|shared)\.mjs$/),
    ...findFiles("extensions", /^sync-shared\.mjs$/),
  ];

  it("finds the sync scripts on disk", () => {
    expect(syncScripts.length).toBeGreaterThan(0);
  });

  it.each(syncScripts)("covers %s", (file) => {
    expect(script).toContain(`node ${file} --check`);
  });
});

interface Step {
  name?: string;
  run?: string;
  uses?: string;
  "working-directory"?: string;
  with?: Record<string, unknown>;
}
interface Job {
  steps?: Step[];
}
const ci = yaml.load(read(".github/workflows/ci.yml")) as { jobs: Record<string, Job> };
const allSteps = Object.values(ci.jobs).flatMap((j) => j.steps ?? []);

describe("ci.yml", () => {
  it("the plugins job type-checks every plugin that has a typecheck script", () => {
    const plugins = fs
      .readdirSync(path.join(root, "plugins"), { withFileTypes: true })
      .filter(
        (e) => e.isDirectory() && fs.existsSync(path.join(root, "plugins", e.name, "package.json")),
      )
      .map((e) => e.name)
      .filter((name) => JSON.parse(read(`plugins/${name}/package.json`)).scripts?.typecheck)
      .filter((name) => !PLUGINS_JOB_EXCEPTIONS.includes(name));
    expect(plugins.length).toBeGreaterThan(0);

    const steps = ci.jobs.plugins?.steps ?? [];
    for (const name of plugins) {
      const step = steps.find((s) => s["working-directory"] === `plugins/${name}`);
      expect(step, `plugins job has a step for ${name}`).toBeDefined();
      expect(step?.run, `${name} step runs typecheck`).toMatch(/npm run typecheck/);
    }
  });

  it("the opscr plugin exception is covered by the opscr job", () => {
    const steps = ci.jobs.opscr?.steps ?? [];
    const step = steps.find((s) => s["working-directory"] === "plugins/structura-plugin-opscr");
    expect(step?.run).toMatch(/npm run typecheck/);
  });

  it("every node-version is the .nvmrc major", () => {
    const major = read(".nvmrc").trim().replace(/^v/, "").split(".")[0];
    const versions = allSteps
      .filter((s) => s.uses?.startsWith("actions/setup-node"))
      .map((s) => String(s.with?.["node-version"]));
    expect(versions.length).toBeGreaterThan(0);
    for (const v of versions) expect(v.split(".")[0]).toBe(major);
  });

  it.each([
    ["lint", /npm run lint\b/],
    ["typecheck", /npm run typecheck\b/],
    ["test", /npm run test\b/],
    ["build", /npm run build\b/],
    ["cycles:check", /npm run cycles:check\b/],
  ])("some job runs %s", (_gate, re) => {
    expect(allSteps.some((s) => s.run && re.test(s.run))).toBe(true);
  });
});
