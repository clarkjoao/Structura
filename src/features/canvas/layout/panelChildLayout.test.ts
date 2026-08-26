import { describe, expect, it } from "vitest";
import { layout } from "./layoutEngine";
import { fromDiagram, resizableIds } from "./fromDiagram";
import { toAppliedLayouts } from "./applyLayout";
import { createTestDiagramStore } from "@/features/diagram/store/test-utils";

/**
 * The `usePanelChildLayout` seam.
 *
 * The hook puts the panel in the graph with its children — that is what lets the
 * layout size it to hold them — and then overwrites only the panel's x/y with
 * where the user dragged it. Those two writes have to agree: a child's position
 * is relative to its parent, so moving the parent must not push anything out of
 * it. This reproduces the hook's body against the real store and checks exactly
 * that. Confirmed by hand in the running app on 2026-08-26 as well: a panel with
 * four children dragged to (1515, 930), then "Organize children (LR)", kept the
 * dragged position, resized 600x400 -> 980x252, and left every child inside.
 */

type Store = ReturnType<typeof createTestDiagramStore>;

function read(store: Store, diagramId: string) {
  const diagram = store.getState().diagrams[diagramId]!;
  return {
    components: diagram.snapshot.components,
    connections: Object.values(diagram.snapshot.connections),
    nodeLayouts: diagram.nodeLayouts,
  };
}

/** The body of `runPanelChildLayout`, minus React, toasts and `getNodes`. */
async function organizeChildren(store: Store, diagramId: string, panelId: string): Promise<void> {
  const { components, connections, nodeLayouts } = read(store, diagramId);
  const graph = fromDiagram(components, connections, nodeLayouts, { rootIds: [panelId] });
  const result = await layout(graph);

  const panelLayout = nodeLayouts[panelId];
  const applied = toAppliedLayouts(graph, result, resizableIds(graph, components)).map((entry) =>
    entry.elementId === panelId && panelLayout
      ? { ...entry, x: panelLayout.x, y: panelLayout.y }
      : entry,
  );

  store.getState().applyAutoLayout(applied);
}

interface Overflow {
  childId: string;
  side: string;
  by: number;
}

function overflows(store: Store, diagramId: string, panelId: string): Overflow[] {
  const { components, nodeLayouts } = read(store, diagramId);
  const panel = nodeLayouts[panelId]!;
  const panelWidth = panel.width ?? 0;
  const panelHeight = panel.height ?? 0;

  const found: Overflow[] = [];
  for (const component of Object.values(components)) {
    if (component.parentId !== panelId) continue;
    const child = nodeLayouts[component.id];
    if (!child) continue;
    // Child positions are relative to the parent, so the parent's own box is
    // [0, width] x [0, height] in the same space.
    const width = child.width ?? 180;
    const height = child.height ?? 80;
    if (child.x < 0) found.push({ childId: component.name, side: "left", by: -child.x });
    if (child.y < 0) found.push({ childId: component.name, side: "top", by: -child.y });
    if (child.x + width > panelWidth) {
      found.push({ childId: component.name, side: "right", by: child.x + width - panelWidth });
    }
    if (child.y + height > panelHeight) {
      found.push({ childId: component.name, side: "bottom", by: child.y + height - panelHeight });
    }
  }
  return found;
}

async function buildDiagram(): Promise<{ store: Store; diagramId: string; panelId: string }> {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("Panel containment", "container");
  store.getState().openDiagram(diagram.id);

  const panel = store.getState().addComponent("panel", "Boundary", null, { x: 200, y: 150 });
  const names = ["Web", "API", "Worker", "Cache", "Queue", "Store"];
  const children = names.map((name, index) =>
    store.getState().addComponent("container", name, panel.id, { x: 20 + index * 30, y: 20 }),
  );

  store.getState().addConnection(children[0].id, children[1].id, "calls");
  store.getState().addConnection(children[1].id, children[2].id, "enqueues");
  store.getState().addConnection(children[1].id, children[3].id, "reads");
  store.getState().addConnection(children[2].id, children[4].id, "publishes");
  store.getState().addConnection(children[4].id, children[5].id, "persists");
  store.getState().addConnection(children[3].id, children[5].id, "warms");

  return { store, diagramId: diagram.id, panelId: panel.id };
}

describe("panel child layout", () => {
  it("keeps every child inside the panel when the panel was dragged first", async () => {
    const { store, diagramId, panelId } = await buildDiagram();

    // Drag: exactly what a pointer drag writes.
    store.getState().updateNodeLayout(panelId, { x: 1340, y: 880 });

    await organizeChildren(store, diagramId, panelId);

    const found = overflows(store, diagramId, panelId);
    const panel = read(store, diagramId).nodeLayouts[panelId]!;
    console.info(
      `\nPanel after drag + organize: x ${panel.x} y ${panel.y} ${panel.width}x${panel.height}\n` +
        (found.length === 0
          ? "No child outside the panel.\n"
          : `OVERFLOW:\n${found.map((o) => `  ${o.childId} ${o.side} by ${o.by}`).join("\n")}\n`),
    );

    expect(panel.x, "the drag position has to survive the layout run").toBe(1340);
    expect(panel.y).toBe(880);
    expect(found, JSON.stringify(found)).toHaveLength(0);
  }, 60000);

  it("also holds for a negative drag position", async () => {
    const { store, diagramId, panelId } = await buildDiagram();
    store.getState().updateNodeLayout(panelId, { x: -720, y: -310 });
    await organizeChildren(store, diagramId, panelId);
    expect(overflows(store, diagramId, panelId)).toHaveLength(0);
  }, 60000);

  /**
   * Control: the same assertion must be able to fail. A panel keeping its old
   * size instead of the computed one is the failure the seam is guarding.
   */
  it("CONTROL: the check catches a panel whose size is not written", async () => {
    const { store, diagramId, panelId } = await buildDiagram();
    store.getState().updateNodeLayout(panelId, { x: 1340, y: 880 });

    const { components, connections, nodeLayouts } = read(store, diagramId);
    const graph = fromDiagram(components, connections, nodeLayouts, { rootIds: [panelId] });
    const result = await layout(graph);
    const panelLayout = nodeLayouts[panelId];

    // `resizableIds` replaced by an empty set: the size is dropped, which is the
    // bug this seam exists to prevent.
    const applied = toAppliedLayouts(graph, result, new Set<string>()).map((entry) =>
      entry.elementId === panelId && panelLayout
        ? { ...entry, x: panelLayout.x, y: panelLayout.y }
        : entry,
    );
    store.getState().applyAutoLayout(applied);

    expect(overflows(store, diagramId, panelId).length).toBeGreaterThan(0);
  }, 60000);
});
