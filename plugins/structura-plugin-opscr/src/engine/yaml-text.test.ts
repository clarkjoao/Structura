import { describe, expect, it } from "vitest";
import { applyEdits, parseDocuments, replaceScalar, scalarAt, setMapValue } from "./yaml-text";
import type { YAMLMap } from "yaml";

const specOf = (text: string) => parseDocuments(text)![0]!.get("spec", true) as YAMLMap;
const set = (text: string, key: string, value: string) =>
  applyEdits(text, [setMapValue(text, specOf(text), key, value)!]);

describe("setMapValue", () => {
  it("writes a value for a key that has none, after the colon", () => {
    const text = "kind: A\nspec:\n  description:\n  other: 1\n";
    const out = set(text, "description", "hello");
    expect(out).toBe("kind: A\nspec:\n  description: hello\n  other: 1\n");
    expect(parseDocuments(out)![0]!.toJS()).toEqual({
      kind: "A",
      spec: { description: "hello", other: 1 },
    });
  });

  it("does not add a second space when the colon already has one", () => {
    expect(set("kind: A\nspec:\n  description: \n", "description", "hi")).toBe(
      "kind: A\nspec:\n  description: hi\n",
    );
  });

  it("replaces an existing value in place, keeping its quoting", () => {
    expect(set("spec:\n  description: 'old' # note\n", "description", "it's")).toBe(
      "spec:\n  description: 'it''s' # note\n",
    );
  });
});

describe("replaceScalar", () => {
  it("adds the space for an empty value when the text is not given", () => {
    const text = "spec:\n  name:\n";
    const node = scalarAt(specOf(text), "name")!;
    expect(applyEdits(text, [replaceScalar(node, "x")])).toBe("spec:\n  name: x\n");
  });
});

describe("applyEdits", () => {
  it("merges cuts that overlap", () => {
    expect(
      applyEdits("aaa---bbb---ccc", [
        { start: 0, end: 6, insert: "" },
        { start: 3, end: 12, insert: "" },
      ]),
    ).toBe("ccc");
  });

  it("refuses an overlap that writes text", () => {
    expect(() =>
      applyEdits("abcdef", [
        { start: 0, end: 4, insert: "x" },
        { start: 2, end: 5, insert: "" },
      ]),
    ).toThrow(/overlapping/);
  });

  it("keeps insertions at the same point in order", () => {
    expect(
      applyEdits("ab", [
        { start: 1, end: 1, insert: "1" },
        { start: 1, end: 1, insert: "2" },
      ]),
    ).toBe("a12b");
  });
});
