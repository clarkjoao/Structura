import { describe, expect, it } from "vitest";
import { borderClassForAccent } from "./accent-border";

describe("borderClassForAccent", () => {
  it("maps a token accent to the matching Tailwind border class", () => {
    expect(borderClassForAccent({ kind: "token", cssVar: "--gcp-compute" })).toBe(
      "border-l-gcp-compute",
    );
  });

  it("returns empty for a neutral accent", () => {
    expect(borderClassForAccent({ kind: "neutral" })).toBe("");
  });

  it("rejects a cssVar that is not a custom property name", () => {
    expect(() => borderClassForAccent({ kind: "token", cssVar: "gcp-compute" })).toThrow(
      /custom-property/,
    );
  });
});
