import { describe, it, expect } from "vitest";
import { layoutDiagram, approximateMeasureText, LAYOUT, type LayoutInput } from "../index";

function run(input: LayoutInput) {
  return layoutDiagram(input, { measureText: approximateMeasureText });
}

/** Top-left of everything drawn, boundaries included. */
function topLeft(state: ReturnType<typeof run>["state"]) {
  let minX = Infinity;
  let minY = Infinity;
  for (const node of state.nodes.values()) {
    minX = Math.min(minX, node.x);
    minY = Math.min(minY, node.y);
  }
  for (const boundary of state.boundaries.values()) {
    minX = Math.min(minX, boundary.x);
    minY = Math.min(minY, boundary.y);
  }
  return { minX, minY };
}

describe("origin normalisation", () => {
  it("keeps a boundaried diagram on canvas", () => {
    // A boundary is drawn above and left of its members, so without normalisation this
    // starts at a negative coordinate and opens partly off-screen.
    const { state } = run({
      nodes: [{ id: "a", type: "container", name: "Service", tier: "application" }],
      boundaries: [{ id: "b", name: "System", kind: "system", contains: ["a"] }],
    });

    const { minX, minY } = topLeft(state);
    expect(minX).toBeGreaterThanOrEqual(0);
    expect(minY).toBeGreaterThanOrEqual(0);
  });

  it("holds under deep nesting, where the offset compounds", () => {
    // Each nesting level adds padding plus a title band; four levels reached about
    // (-80, -200) before this pass existed.
    const depth = 4;
    const boundaries = Array.from({ length: depth }, (_, i) => ({
      id: `b${i}`,
      name: `Level ${i}`,
      kind: "trust-zone" as const,
      contains: i === depth - 1 ? ["leaf"] : [],
      ...(i > 0 ? { parentBoundaryId: `b${i - 1}` } : {}),
    }));

    const { state } = run({
      nodes: [{ id: "leaf", type: "container", name: "Leaf", tier: "application" }],
      boundaries,
    });

    const { minX, minY } = topLeft(state);
    expect(minX).toBeGreaterThanOrEqual(0);
    expect(minY).toBeGreaterThanOrEqual(0);
  });

  it("lands the diagram at the configured origin", () => {
    const { state } = run({
      nodes: [{ id: "a", type: "container", name: "Service", tier: "application" }],
      boundaries: [{ id: "b", name: "System", kind: "system", contains: ["a"] }],
    });

    const { minX, minY } = topLeft(state);
    // Within one grid step of the origin, since the snap runs afterwards.
    expect(Math.abs(minX - LAYOUT.ORIGIN_X)).toBeLessThanOrEqual(LAYOUT.GRID);
    expect(Math.abs(minY - LAYOUT.ORIGIN_Y)).toBeLessThanOrEqual(LAYOUT.GRID);
  });

  it("preserves relative geometry — it is a rigid translation", () => {
    const input: LayoutInput = {
      nodes: [
        { id: "a", type: "container", name: "A", tier: "application" },
        { id: "b", type: "container", name: "B", tier: "data" },
      ],
      boundaries: [{ id: "box", name: "Box", kind: "system", contains: ["a", "b"] }],
      connections: [{ id: "e1", from: "a", to: "b", intent: "call" }],
    };

    const { state } = run(input);
    const a = state.nodes.get("a")!;
    const b = state.nodes.get("b")!;
    const box = state.boundaries.get("box")!;

    // Containment and ordering survive the shift.
    expect(a.x).toBeLessThan(b.x);
    expect(a.x).toBeGreaterThanOrEqual(box.x);
    expect(b.x + b.width).toBeLessThanOrEqual(box.x + box.width);
  });

  it("leaves an already-positive diagram where it was", () => {
    // No boundaries, so nothing extends above the origin and there is nothing to correct.
    const withoutBoundary = run({
      nodes: [{ id: "a", type: "container", name: "Service", tier: "application" }],
    });

    const { minX, minY } = topLeft(withoutBoundary.state);
    expect(minX).toBe(LAYOUT.ORIGIN_X);
    expect(minY).toBe(LAYOUT.ORIGIN_Y);
  });

  it("keeps the cross-cutting band on canvas too", () => {
    const { state } = run({
      nodes: [
        { id: "app", type: "container", name: "App", tier: "application" },
        { id: "logs", type: "container", name: "Logs", tier: "cross-cutting" },
      ],
      boundaries: [{ id: "b", name: "System", kind: "system", contains: ["app"] }],
    });

    const { minX, minY } = topLeft(state);
    expect(minX).toBeGreaterThanOrEqual(0);
    expect(minY).toBeGreaterThanOrEqual(0);
  });

  it("stays on the grid after shifting", () => {
    const { state } = run({
      nodes: [{ id: "a", type: "container", name: "Service", tier: "application" }],
      boundaries: [{ id: "b", name: "System", kind: "system", contains: ["a"] }],
    });

    for (const node of state.nodes.values()) {
      expect(node.x % LAYOUT.GRID).toBe(0);
      expect(node.y % LAYOUT.GRID).toBe(0);
    }
  });

  it("is deterministic", () => {
    const input: LayoutInput = {
      nodes: [{ id: "a", type: "container", name: "Service", tier: "application" }],
      boundaries: [{ id: "b", name: "System", kind: "system", contains: ["a"] }],
    };

    expect(run(input).nodes.map((n) => n.position)).toEqual(
      run(input).nodes.map((n) => n.position),
    );
  });
});
