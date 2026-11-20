import { describe, expect, it } from "vitest";
import {
  KIND_DATA_MAX_CHARS,
  hasKind,
  isKindFreehandMode,
  isKindId,
  sanitizeKindFields,
  withSanitizedKindFields,
} from "./diagram-kind";

describe("kind ids", () => {
  it("accepts built-in kebab-case ids and namespaced contributed ids", () => {
    expect(isKindId("guided")).toBe(true);
    expect(isKindId("value-stream")).toBe(true);
    expect(isKindId("acme-vsm:value-stream")).toBe(true);
    expect(isKindId("@acme/plugin:blueprint")).toBe(true);
  });

  it("refuses malformed ids and the freehand pseudo-kind", () => {
    for (const id of [42, "", "Guided", "guided ", "a--b", "freehand", ":x", "p:", "p:Bad", null]) {
      expect(isKindId(id)).toBe(false);
    }
  });
});

describe("kind guards", () => {
  it("reads absent fields as freehand", () => {
    expect(hasKind({})).toBe(false);
    expect(isKindFreehandMode({ kindMode: "freehand" })).toBe(false);
  });

  it("reads a kind in freehand mode", () => {
    expect(hasKind({ kind: "guided" })).toBe(true);
    expect(isKindFreehandMode({ kind: "guided" })).toBe(false);
    expect(isKindFreehandMode({ kind: "guided", kindMode: "freehand" })).toBe(true);
  });
});

describe("sanitizeKindFields", () => {
  it("keeps a well-formed kind that nothing registers", () => {
    expect(
      sanitizeKindFields({
        kind: "acme-vsm:value-stream",
        kindMode: "freehand",
        kindData: { a: 1 },
      }),
    ).toEqual({ kind: "acme-vsm:value-stream", kindMode: "freehand", kindData: { a: 1 } });
  });

  it("drops a malformed kind, and its mode and data with it", () => {
    expect(sanitizeKindFields({ kind: 42, kindMode: "freehand", kindData: { a: 1 } })).toEqual({});
  });

  it("drops a malformed mode or data and keeps the kind", () => {
    expect(sanitizeKindFields({ kind: "guided", kindMode: "free", kindData: "x" })).toEqual({
      kind: "guided",
    });
    expect(sanitizeKindFields({ kind: "guided", kindData: [1, 2] })).toEqual({ kind: "guided" });
    expect(sanitizeKindFields({ kind: "guided", kindData: { n: Number.NaN } })).toEqual({
      kind: "guided",
    });
  });

  it("drops kind data over the size cap", () => {
    const big = { text: "x".repeat(KIND_DATA_MAX_CHARS) };
    expect(sanitizeKindFields({ kind: "guided", kindData: big })).toEqual({ kind: "guided" });
  });

  it("removes absent fields instead of writing undefined", () => {
    const out = withSanitizedKindFields({ id: "d", kind: "bad kind" }, { kind: "bad kind" });
    expect(Object.keys(out)).toEqual(["id"]);
  });
});
