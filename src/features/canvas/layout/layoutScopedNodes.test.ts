import { beforeEach, describe, expect, it } from "vitest";
import { layoutScopedNodes } from "./layoutScopedNodes";
import { fromDiagram } from "./fromDiagram";
import {
  parseMermaidFlowchart,
  useDiagramStore,
  type Component,
  type Connection,
  type NodeLayout,
} from "@/features/diagram";

/**
 * The mermaid import path, end to end.
 *
 * `FlowPanel.preselectAfterImport` runs `layoutScopedNodes` immediately after an
 * import, so the grid the importer seeds (GRID_H_GAP/GRID_V_GAP) is never what the
 * user sees — the engine's positions are. This is also the only consumer that
 * anchors the result somewhere other than (0,0), which makes it the only place the
 * node offset and the waypoint offset can drift apart.
 *
 * What is locked here:
 *   - the grid seed is actually replaced by the engine's geometry;
 *   - the result is centred on the insertion anchor;
 *   - waypoints are shifted by the same offset as the nodes, so they stay between
 *     the boxes they were routed for instead of collapsing towards the origin;
 *   - a scoped run that includes a parent keeps children inside it.
 */

const FLOWCHART = `flowchart LR
  A[Client] --> B[Gateway]
  B --> C[Orders]
  B --> D[Billing]
  C --> E[Orders DB]
  D --> E
`;

const ANCHOR = { x: 4000, y: 3000 };

function freshDiagram(): string {
  useDiagramStore.setState({ diagrams: {}, activeDiagramId: null, past: [], future: [] });
  const diagram = useDiagramStore.getState().addDiagram("Import", "context");
  useDiagramStore.getState().openDiagram(diagram.id);
  return diagram.id;
}

function stateOf(diagramId: string) {
  const d = useDiagramStore.getState().diagrams[diagramId]!;
  return { nodeLayouts: d.nodeLayouts, edgeLayouts: d.edgeLayouts, snapshot: d.snapshot };
}

/** Run the import exactly as `FlowPanel.handleMermaidFlowchartImport` does. */
async function importAndLayout(diagramId: string) {
  const { components, connections } = useDiagramStore.getState().diagrams[diagramId]!.snapshot;
  const plan = parseMermaidFlowchart(FLOWCHART, components, connections, ANCHOR);
  expect(plan.errors, plan.errors.join("; ")).toHaveLength(0);
  expect(plan.newComponents.length).toBeGreaterThan(0);

  const createdIds = useDiagramStore
    .getState()
    .importDrawioResult(plan.newComponents, plan.newConnections, plan.layouts);
  const connectionIds = plan.newConnections.map((c) => c.id);

  // The grid the importer seeded, before the engine gets to it.
  const seeded = Object.fromEntries(
    createdIds.map((id) => {
      const l = stateOf(diagramId).nodeLayouts[id]!;
      return [id, { x: l.x, y: l.y }];
    }),
  );

  const applied = await layoutScopedNodes({
    nodeIds: createdIds,
    connectionIds,
    components: stateOf(diagramId).snapshot.components,
    connections: stateOf(diagramId).snapshot.connections,
    nodeLayouts: stateOf(diagramId).nodeLayouts,
    anchor: ANCHOR,
    activeDiagramId: diagramId,
    applyAutoLayout: useDiagramStore.getState().applyAutoLayout,
  });

  return { applied, createdIds, connectionIds, seeded };
}

describe("layoutScopedNodes — mermaid import path", () => {
  let diagramId: string;

  beforeEach(() => {
    diagramId = freshDiagram();
  });

  it("replaces the importer's grid seed with the engine's geometry", async () => {
    const { applied, createdIds, seeded } = await importAndLayout(diagramId);
    expect(applied).toBe(true);

    const after = stateOf(diagramId).nodeLayouts;
    const moved = createdIds.filter(
      (id) => after[id]!.x !== seeded[id].x || after[id]!.y !== seeded[id].y,
    );

    // The grid stacks 3 per row with a fixed gap; a real layout does not.
    expect(moved.length, "no node moved off the seeded grid").toBe(createdIds.length);
  });

  it("centres the imported subgraph on the insertion anchor", async () => {
    const { createdIds } = await importAndLayout(diagramId);
    const after = stateOf(diagramId).nodeLayouts;

    const boxes = createdIds.map((id) => after[id]!);
    const minX = Math.min(...boxes.map((b) => b.x));
    const maxX = Math.max(...boxes.map((b) => b.x + (b.width ?? 0)));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxY = Math.max(...boxes.map((b) => b.y + (b.height ?? 0)));

    // Half a node of slack: the engine's bounds include padding the boxes do not.
    expect((minX + maxX) / 2).toBeCloseTo(ANCHOR.x, -2);
    expect((minY + maxY) / 2).toBeCloseTo(ANCHOR.y, -2);
  });

  it("shifts waypoints by the same offset as the nodes", async () => {
    const { createdIds, connectionIds } = await importAndLayout(diagramId);
    const { nodeLayouts, edgeLayouts } = stateOf(diagramId);

    const boxes = createdIds.map((id) => nodeLayouts[id]!);
    const minX = Math.min(...boxes.map((b) => b.x));
    const maxX = Math.max(...boxes.map((b) => b.x + (b.width ?? 0)));
    const minY = Math.min(...boxes.map((b) => b.y));
    const maxY = Math.max(...boxes.map((b) => b.y + (b.height ?? 0)));

    const routed = connectionIds.filter((id) => (edgeLayouts[id]?.points?.length ?? 0) > 0);
    expect(routed.length, "no edge got waypoints — nothing to check").toBeGreaterThan(0);

    // A waypoint that kept the un-offset ELK coordinates would sit near the origin,
    // thousands of units away from the nodes it is supposed to route between.
    const margin = 400;
    for (const id of routed) {
      for (const p of edgeLayouts[id]?.points ?? []) {
        expect(p.x, `waypoint x of ${id}`).toBeGreaterThan(minX - margin);
        expect(p.x, `waypoint x of ${id}`).toBeLessThan(maxX + margin);
        expect(p.y, `waypoint y of ${id}`).toBeGreaterThan(minY - margin);
        expect(p.y, `waypoint y of ${id}`).toBeLessThan(maxY + margin);
      }
    }
  });

  it("grows the parent so its children fit inside it", async () => {
    // Mermaid itself imports flat, so containment is exercised through the same
    // function with a scope that has a real parent in it.
    const panel = useDiagramStore.getState().addComponent("panel", "Services", null, { x: 0, y: 0 });
    const children = ["A", "B", "C", "D", "E", "F"].map((name) =>
      useDiagramStore.getState().addComponent("system", name, panel.id, { x: 0, y: 0 }),
    );
    for (let i = 0; i < children.length - 1; i += 1) {
      useDiagramStore.getState().addConnection(children[i]!.id, children[i + 1]!.id, "");
    }

    const before = stateOf(diagramId);
    const panelSizeBefore = { ...before.nodeLayouts[panel.id]! };
    const nodeIds = [panel.id, ...children.map((c) => c.id)];
    const connectionIds = Object.keys(before.snapshot.connections);

    // The sizes the engine actually lays out with — children store no width of
    // their own, so reading them back from the store would assert nothing.
    const graph = fromDiagram(
      Object.fromEntries(nodeIds.map((id) => [id, before.snapshot.components[id]])) as Record<
        string,
        Component
      >,
      connectionIds.map((id) => before.snapshot.connections[id]) as Connection[],
      before.nodeLayouts as Record<string, NodeLayout>,
    );
    const sizeOf = new Map(graph.nodes.map((n) => [n.id, { w: n.width, h: n.height }]));

    const applied = await layoutScopedNodes({
      nodeIds,
      connectionIds,
      components: before.snapshot.components as Record<string, Component>,
      connections: before.snapshot.connections as Record<string, Connection>,
      nodeLayouts: before.nodeLayouts as Record<string, NodeLayout>,
      anchor: ANCHOR,
      activeDiagramId: diagramId,
      applyAutoLayout: useDiagramStore.getState().applyAutoLayout,
    });
    expect(applied).toBe(true);

    const after = stateOf(diagramId).nodeLayouts;
    const parent = after[panel.id]!;

    // A chain of six is wider than a freshly created panel: if the panel is not
    // resized to what the layout computed, the children hang outside it.
    expect(parent.width, "panel did not grow to fit its children").toBeGreaterThan(
      panelSizeBefore.width ?? 0,
    );

    for (const child of children) {
      const c = after[child.id]!;
      const size = sizeOf.get(child.id)!;
      // Children are stored relative to their parent.
      expect(c.x, `${child.name} x inside parent`).toBeGreaterThanOrEqual(0);
      expect(c.y, `${child.name} y inside parent`).toBeGreaterThanOrEqual(0);
      expect(c.x + size.w, `${child.name} right edge`).toBeLessThanOrEqual(parent.width ?? 0);
      expect(c.y + size.h, `${child.name} bottom edge`).toBeLessThanOrEqual(parent.height ?? 0);
    }
  });
});
