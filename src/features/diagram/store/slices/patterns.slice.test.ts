import { describe, expect, it } from "vitest";
import type { PatternFragment } from "../../model/pattern-fragment.types";
import { createTestDiagramStore } from "../test-utils";

/** Two cards and a boundary holding a third, as the resolver hands them over. */
const fragment: PatternFragment = {
  patternId: "test-pattern",
  nodes: [
    { type: "system", name: "A", createOptions: {}, parentIndex: null, x: 0, y: 0 },
    {
      type: "aws-integration",
      name: "Orders queue",
      createOptions: { serviceId: "sqs" },
      parentIndex: null,
      x: 300,
      y: 0,
    },
    {
      type: "panel",
      name: "Cell",
      createOptions: {},
      parentIndex: null,
      x: 600,
      y: 0,
      width: 320,
      height: 206,
    },
    { type: "container", name: "Inside", createOptions: {}, parentIndex: 2, x: 30, y: 56 },
  ],
  edges: [
    { from: 0, to: 1, label: "publish" },
    { from: 1, to: 3, label: "consume" },
  ],
  width: 920,
  height: 206,
};

function seed() {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("P", "context");
  store.getState().openDiagram(diagram.id);
  return { store, diagramId: diagram.id };
}

describe("insertPattern (catalog fragment)", () => {
  it("writes every node and edge, built and sized like an inserted element", () => {
    const { store, diagramId } = seed();
    const ids = store.getState().insertPattern(fragment, { x: 10, y: 20 });
    const d = store.getState().diagrams[diagramId]!;

    expect(ids).toHaveLength(4);
    expect(d.snapshot.components[ids[1]]).toMatchObject({
      type: "aws-integration",
      cloudServiceId: "sqs",
    });
    expect(d.nodeLayouts[ids[0]]).toMatchObject({ x: 10, y: 20 });
    expect(d.nodeLayouts[ids[0]].width).toBeGreaterThan(0);
    expect(d.nodeLayouts[ids[2]]).toMatchObject({ width: 320, height: 206 });
    expect(d.snapshot.components[ids[3]].parentId).toBe(ids[2]);
    expect(d.nodeLayouts[ids[3]]).toMatchObject({ x: 30, y: 56 });
    expect(Object.values(d.snapshot.connections).map((c) => c.label)).toEqual([
      "publish",
      "consume",
    ]);
  });

  it("is one undo step", () => {
    const { store, diagramId } = seed();
    const before = store.getState().past.length;
    const ids = store.getState().insertPattern(fragment, { x: 0, y: 0 });
    expect(store.getState().past.length).toBe(before + 1);
    store.getState().undo();
    const d = store.getState().diagrams[diagramId]!;
    for (const id of ids) expect(d.snapshot.components[id]).toBeUndefined();
    expect(Object.keys(d.snapshot.connections)).toHaveLength(0);
  });

  it("moves right of existing nodes instead of covering them", () => {
    const { store, diagramId } = seed();
    const existing = store.getState().addComponent("system", "Existing", null, { x: 100, y: 50 });
    const ids = store.getState().insertPattern(fragment, { x: 0, y: 0 });
    const d = store.getState().diagrams[diagramId]!;
    const occupied = d.nodeLayouts[existing.id];
    expect(d.nodeLayouts[ids[0]].x).toBeGreaterThanOrEqual(occupied.x + (occupied.width ?? 0));
    expect(d.nodeLayouts[ids[0]].y).toBe(0);
  });

  it("returns empty array when no diagram is active", () => {
    const store = createTestDiagramStore();
    store.getState().addDiagram("Orphan", "context");
    expect(store.getState().insertPattern(fragment, { x: 0, y: 0 })).toEqual([]);
  });
});
