import { describe, expect, it } from "vitest";
import { allInView, framingSignature } from "./framing";

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

describe("allInView", () => {
  const box = { x: 100, y: 100, width: 180, height: 80 };

  it("is true for a box wholly on screen, false for one cut by an edge", () => {
    expect(allInView([box], [0, 0, 1], 800, 600)).toBe(true);
    expect(allInView([box], [-150, 0, 1], 800, 600)).toBe(false);
    expect(allInView([box], [0, 0, 1], 250, 600)).toBe(false);
  });

  it("accounts for the zoom", () => {
    // At 2x the box spans 200..560 on screen: inside 600, not inside 500.
    expect(allInView([box], [0, 0, 2], 600, 600)).toBe(true);
    expect(allInView([box], [0, 0, 2], 500, 600)).toBe(false);
  });
});
