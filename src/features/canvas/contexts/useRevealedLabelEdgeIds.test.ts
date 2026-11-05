import { renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useRevealedLabelEdgeIds } from "./useRevealedLabelEdgeIds";

/**
 * Every edge reads this value through context, so a new identity re-renders all
 * of them. It must only move when the revealed edges actually change.
 */
type Ends = { id: string; sourceId: string; targetId: string };

const connections: Record<string, Ends> = {
  c1: { id: "c1", sourceId: "a", targetId: "b" },
  c2: { id: "c2", sourceId: "b", targetId: "c" },
  c3: { id: "c3", sourceId: "x", targetId: "y" },
};

describe("useRevealedLabelEdgeIds", () => {
  it("reveals the edges touching a selected node", () => {
    const { result } = renderHook(() => useRevealedLabelEdgeIds(connections, new Set(["b"])));
    expect([...result.current].sort()).toEqual(["c1", "c2"]);
  });

  it("keeps its identity when a store write leaves the revealed edges unchanged", () => {
    const selected = new Set(["b"]);
    const { result, rerender } = renderHook(
      ({ conns }) => useRevealedLabelEdgeIds(conns, selected),
      { initialProps: { conns: connections } },
    );
    const first = result.current;
    // A write elsewhere in the diagram hands over a new connections record.
    rerender({ conns: { ...connections, c4: { id: "c4", sourceId: "x", targetId: "z" } } });
    expect(result.current).toBe(first);
  });

  it("changes identity when the revealed edges change", () => {
    const { result, rerender } = renderHook(
      ({ selected }) => useRevealedLabelEdgeIds(connections, selected),
      { initialProps: { selected: new Set(["a"]) } },
    );
    const first = result.current;
    rerender({ selected: new Set(["c"]) });
    expect(result.current).not.toBe(first);
    expect([...result.current]).toEqual(["c2"]);
  });

  it("returns one shared empty set while nothing is selected", () => {
    const { result, rerender } = renderHook(
      ({ conns }) => useRevealedLabelEdgeIds(conns, new Set()),
      { initialProps: { conns: connections } },
    );
    const first = result.current;
    rerender({ conns: { ...connections } });
    expect(result.current).toBe(first);
    expect(result.current.size).toBe(0);
  });
});
