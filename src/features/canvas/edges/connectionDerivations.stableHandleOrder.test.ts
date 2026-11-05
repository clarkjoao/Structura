import { describe, expect, it } from "vitest";
import { stabilizeHandleOrder } from "./connectionDerivations";

/**
 * Each node's handle order lands on its `data`; a new object per store write
 * re-rendered every connected node. Unchanged entries keep their identity.
 */
describe("stabilizeHandleOrder", () => {
  const previous = {
    a: { incoming: [], outgoing: ["c1", "c2"] },
    b: { incoming: ["c1"], outgoing: [] },
  };

  it("keeps the previous record when nothing changed", () => {
    const next = {
      a: { incoming: [], outgoing: ["c1", "c2"] },
      b: { incoming: ["c1"], outgoing: [] },
    };
    expect(stabilizeHandleOrder(previous, next)).toBe(previous);
  });

  it("keeps unchanged entries and replaces the changed one", () => {
    const next = {
      a: { incoming: [], outgoing: ["c2", "c1"] },
      b: { incoming: ["c1"], outgoing: [] },
    };
    const result = stabilizeHandleOrder(previous, next);
    expect(result).not.toBe(previous);
    expect(result.b).toBe(previous.b);
    expect(result.a).toEqual({ incoming: [], outgoing: ["c2", "c1"] });
  });

  it("notices added and removed nodes", () => {
    const added = stabilizeHandleOrder(previous, {
      ...previous,
      c: { incoming: ["c2"], outgoing: [] },
    });
    expect(added).not.toBe(previous);
    expect(added.a).toBe(previous.a);

    const removed = stabilizeHandleOrder(previous, { a: { incoming: [], outgoing: ["c1", "c2"] } });
    expect(removed).not.toBe(previous);
    expect(Object.keys(removed)).toEqual(["a"]);
  });

  it("treats a hole in the slots as different from a filled slot", () => {
    const sparse: string[] = [];
    sparse[1] = "c1";
    const result = stabilizeHandleOrder(
      { a: { incoming: ["c1", "c1"], outgoing: [] } },
      { a: { incoming: sparse, outgoing: [] } },
    );
    expect(result.a!.incoming).toBe(sparse);
  });
});
