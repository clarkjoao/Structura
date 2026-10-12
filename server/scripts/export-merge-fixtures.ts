/**
 * Write the merge fixtures as JSON for the Go relay (`go-server/`), which runs the same cases
 * against its stores. `merge.fixtures.export.test.ts` fails when the JSON is stale.
 *
 *   npx tsx scripts/export-merge-fixtures.ts
 */
import { writeFileSync } from "node:fs";
import { GO_FIXTURES_PATH, mergeFixturesJson } from "../src/collab/store/__fixtures__/export.js";

writeFileSync(GO_FIXTURES_PATH, mergeFixturesJson());
console.log(`wrote ${GO_FIXTURES_PATH}`);
