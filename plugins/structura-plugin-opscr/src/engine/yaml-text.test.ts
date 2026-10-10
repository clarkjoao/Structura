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
