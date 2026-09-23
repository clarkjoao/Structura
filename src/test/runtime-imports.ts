import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";

const ROOT = process.cwd();

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith("@/")) base = join(ROOT, "src", spec.slice(2));
  else if (spec.startsWith(".")) base = resolve(dirname(from), spec);
  // A package: recorded by name, not walked.
  else return join(ROOT, "node_modules", spec, "index.js");
  for (const ext of ["", ".ts", ".tsx", "/index.ts", "/index.tsx"]) {
    const candidate = base + ext;
    if (existsSync(candidate) && statSync(candidate).isFile()) return candidate;
  }
  return null;
}

/**
 * Every module `entry` reaches through static runtime imports, as paths
 * relative to the repo root.
 *
 * `import type` is erased, so skipped; `import()` is a separate chunk, so not
 * followed. That is the graph the bundler puts in the same load as `entry`.
 */
export function runtimeImportsOf(entry: string): string[] {
  const seen = new Set<string>();
  const stack = [resolve(ROOT, entry)];
  // `from` is optional: a side-effect import (`import "./bootstrap"`) loads its
  // module like any other, and the entry is mostly those.
  const statement =
    /(?:^|\n)\s*(?:import|export)\s+(type\s+)?(?:[^;'"]*?from\s+)?["']([^"']+)["']/g;
  while (stack.length > 0) {
    const file = stack.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    if (!/\.tsx?$/.test(file)) continue;
    const source = readFileSync(file, "utf8");
    for (const match of source.matchAll(statement)) {
      if (match[1]) continue;
      const target = resolveImport(file, match[2]!);
      if (target && !seen.has(target)) stack.push(target);
    }
  }
  return [...seen].map((file) => relative(ROOT, file));
}
