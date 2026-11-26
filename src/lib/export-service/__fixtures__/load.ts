import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Reads a committed fixture, e.g. `fixture("drawio/cloud-service-id.drawio")`. Tests only. */
export function fixture(relativePath: string): string {
  return readFileSync(resolve(__dirname, relativePath), "utf8");
}

export function jsonFixture(relativePath: string): unknown {
  return JSON.parse(fixture(relativePath));
}
