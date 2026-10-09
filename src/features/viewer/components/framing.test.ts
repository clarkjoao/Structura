import { describe, expect, it } from "vitest";
import { framingSignature } from "./framing";

describe("framingSignature", () => {
  const canvas =
    (nodes: Record<string, { width?: number; height?: number } | undefined>) => (id: string) =>
      id in nodes ? nodes[id] : null;

  it("waits while any element on the canvas is unmeasured", () => {
    // A was drawn before the update; C is new and not measured yet.
    expect(
      framingSignature(["a", "c"], canvas({ a: { width: 100, height: 40 }, c: undefined })),
    ).toBeNull();
    expect(
      framingSignature(["a", "c"], canvas({ a: { width: 100, height: 40 }, c: {} })),
    ).toBeNull();
  });

  it("skips ids that are not on the canvas, and waits when none is", () => {
    expect(framingSignature(["a", "gone"], canvas({ a: { width: 1, height: 2 } }))).toBe("a:1x2");
    expect(framingSignature(["gone"], canvas({}))).toBeNull();
  });

  it("changes when an element is measured again at a new size", () => {
    const before = framingSignature(["a"], canvas({ a: { width: 100, height: 40 } }));
    const after = framingSignature(["a"], canvas({ a: { width: 240, height: 40 } }));
    expect(before).not.toBe(after);
  });
});
