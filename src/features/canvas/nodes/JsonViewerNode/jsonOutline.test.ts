import { describe, expect, it } from "vitest";
import { jsonOutline, jsonSyntaxError } from "./jsonOutline";

describe("jsonOutline", () => {
  it("names each top-level key and the kind of value it holds", () => {
    const outline = jsonOutline(
      JSON.stringify({ id: "a", total: 3, items: [1, 2], meta: { x: 1 }, ok: true, none: null }),
      4,
    );
    expect(outline).toEqual({
      valid: true,
      root: "object",
      total: 6,
      entries: [
        { key: "id", kind: "string" },
        { key: "total", kind: "number" },
        { key: "items", kind: "array", size: 2 },
        { key: "meta", kind: "object", size: 1 },
      ],
    });
  });

  it("lists an array's items by index", () => {
    const outline = jsonOutline('[{"a":1},2]', 3);
    expect(outline).toMatchObject({
      root: "array",
      total: 2,
      entries: [
        { key: "[0]", kind: "object", size: 1 },
        { key: "[1]", kind: "number" },
      ],
    });
  });

  it("says when the text is not JSON", () => {
    expect(jsonOutline("{nope", 3)).toEqual({ valid: false });
  });
});

describe("jsonSyntaxError", () => {
  it("is null for valid JSON", () => {
    expect(jsonSyntaxError('{"a":1}')).toBeNull();
  });

  it("points at the line and column where parsing stopped", () => {
    const error = jsonSyntaxError('{\n  "a": 1\n  "b": 2\n}');
    expect(error?.line).toBe(3);
    expect(error?.column).toBeGreaterThan(0);
  });
});
