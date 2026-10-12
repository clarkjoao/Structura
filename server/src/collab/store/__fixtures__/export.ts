import path from "node:path";
import { fileURLToPath } from "node:url";
import { MERGE_FIXTURES } from "./merge.fixtures.js";

const here = path.dirname(fileURLToPath(import.meta.url));

/** Where the Go relay reads the fixtures, when it sits next to this server in the repo. */
export const GO_FIXTURES_PATH = path.resolve(
  here,
  "../../../../../go-server/internal/merge/testdata/merge.fixtures.json",
);

export function mergeFixturesJson(): string {
  return `${JSON.stringify(MERGE_FIXTURES, null, 2)}\n`;
}
