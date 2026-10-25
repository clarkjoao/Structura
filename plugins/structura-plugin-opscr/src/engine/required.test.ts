import { compileSources } from "opscr/core";
import { describe, expect, it } from "vitest";
import { DRAWN_KINDS } from "../generated/opscr-mapping";
import { manifestSource } from "./adopt";

const errorsOf = async (text: string) => {
  const { result } = await compileSources({ files: [{ path: "new.opscr.yaml", content: text }] });
  return result.diagnostics.filter((d) => d.severity === "error").map((d) => d.message);
};

describe("a manifest written from the canvas", () => {
  it("carries every field its Kind requires, so the folder still compiles", async () => {
    for (const kind of DRAWN_KINDS) {
      expect(await errorsOf(manifestSource(kind, "added", "")), kind).toEqual([]);
    }
  });

  it("keeps the provider picked on the canvas, and marks what it guessed for review", () => {
    const text = manifestSource("Topic", "orders", "Order events", "Kafka");
    expect(text).toContain('provider: "Kafka"\n');
    expect(text).toMatch(/type: "Command" # .*review/);
  });
});
