/**
 * Test-only: the opscr sample workspace as committed in the linked opscr checkout. Read from
 * git, not the working tree, so local edits there (a manual test bound to that folder, say) do
 * not change what the tests expect.
 */
import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname } from "node:path";

const root = dirname(createRequire(import.meta.url).resolve("opscr/package.json"));
const git = (...args: string[]) => execFileSync("git", ["-C", root, ...args], { encoding: "utf8" });

/** File name → text of every file in `examples/sample` at HEAD. */
export const SAMPLE_FILES: Readonly<Record<string, string>> = Object.fromEntries(
  git("ls-tree", "--name-only", "HEAD", "examples/sample/")
    .split("\n")
    .filter(Boolean)
    .map((path) => [path.split("/").pop()!, git("show", `HEAD:${path}`)]),
);
