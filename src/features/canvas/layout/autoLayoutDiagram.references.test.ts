import { describe, expect, it } from "vitest";
import { useDiagramStore } from "@/features/diagram";
import type { DiagramLayoutSettings } from "@/features/diagram/model/layout-settings";
import type { DiagramDirection } from "@/features/diagram/model/diagram.types";
import { applyDiagramAutoLayout, planDiagramAutoLayout } from "./autoLayoutDiagram";

/**
 * The arrangement makes references the way the diagram's settings ask, by
 * reading rules unless told otherwise. A chain of five that loops back is a
 * cycle: laid out in layers, one of its connections has to point four columns
 * back — which one is ELK's to break — and the rules end that one on a
 * reference beside its consumer.
 */

function chainWithLoop() {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Loop back", "container");
  store.openDiagram(diagram.id);
  const ids = ["A", "B", "C", "D", "E"].map(
    (name, i) =>
      useDiagramStore.getState().addComponent("system", name, null, { x: i * 300, y: 0 }).id,
  );
  for (let i = 0; i < ids.length - 1; i += 1) {
    useDiagramStore.getState().addConnection(ids[i]!, ids[i + 1]!, "calls");
  }
  useDiagramStore.getState().addConnection(ids[4]!, ids[0]!, "retries");
  return { diagramId: diagram.id };
}

/** The connection a reference stands in for: from its one consumer to its original. */
function loopsBack(ref: { originalId: string; sourceIds: readonly string[] }) {
  const state = useDiagramStore.getState();
  const diagram = state.diagrams[state.activeDiagramId!]!;
  return Object.values(diagram.snapshot.connections).some(
    (c) => c.sourceId === ref.sourceIds[0] && c.targetId === ref.originalId,
  );
}

function planFor(settings?: DiagramLayoutSettings, direction?: DiagramDirection) {
  const state = useDiagramStore.getState();
  const diagram = state.diagrams[state.activeDiagramId!]!;
  return planDiagramAutoLayout({
    components: diagram.snapshot.components,
    connections: Object.values(diagram.snapshot.connections),
    nodeLayouts: diagram.nodeLayouts,
    autoRefs: true,
    ...(settings && { settings }),
    ...(direction && { direction }),
  });
}

describe("references in the whole-diagram arrangement", () => {
  it("by default ends a far back-connection on a reference beside its consumer", async () => {
    chainWithLoop();
    const plan = await planFor();
    expect(plan.autoRefs).toHaveLength(1);
    expect(plan.autoRefs![0]).toMatchObject({ parentId: null, sourceIds: [expect.any(String)] });
    expect(loopsBack(plan.autoRefs![0]!)).toBe(true);
    expect(plan.ruleRefStats).toMatchObject({ backEdges: 1, movedEdges: 1, refs: 1 });
  });

  it("leaves it a back-edge when the neighbour distance reaches it", async () => {
    chainWithLoop();
    const plan = await planFor({ refNeighborColumns: 6 });
    expect(plan.autoRefs).toEqual([]);
    expect(plan.ruleRefStats).toMatchObject({ backEdges: 1, neighborBackEdges: 1, refs: 0 });
  });

  it("makes none when references are off, and keeps the trial mode as it was", async () => {
    chainWithLoop();
    const off = await planFor({ references: "off" });
    expect(off.autoRefs).toEqual([]);
    expect(off.ruleRefStats).toBeUndefined();
    const trial = await planFor({ references: "auto" });
    // No element here is used by enough others to be tried as a hub.
    expect(trial.autoRefs).toEqual([]);
    expect(trial.ruleRefStats).toBeUndefined();
  });

  it("reads top to bottom the same way", async () => {
    chainWithLoop();
    const plan = await planFor(undefined, "TB");
    expect(plan.autoRefs).toHaveLength(1);
    expect(loopsBack(plan.autoRefs![0]!)).toBe(true);
  });

  it("writes the reference and moves the connection onto it, and the next run reuses it", async () => {
    const { diagramId } = chainWithLoop();
    const plan = await planFor();
    applyDiagramAutoLayout(plan, diagramId);
    const after = useDiagramStore.getState().diagrams[diagramId]!;
    const { refId, originalId, sourceIds } = plan.autoRefs![0]!;
    expect(after.snapshot.components[refId]).toMatchObject({
      type: "shared-ref",
      refOf: originalId,
    });
    const moved = Object.values(after.snapshot.connections).filter(
      (c) => c.sourceId === sourceIds[0] && c.targetId === refId,
    );
    expect(moved).toHaveLength(1);
    // Arranging again folds it back, measures without it and makes the same one.
    const again = await planFor();
    expect(again.autoRefs?.map((a) => a.refId)).toEqual([refId]);
  });
});
