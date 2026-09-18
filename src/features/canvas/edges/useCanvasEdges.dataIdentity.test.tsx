import { beforeEach, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { appendFileSync } from "node:fs";
import type { Edge } from "@xyflow/react";
import {
  useDiagramStore,
  useResolvedComponents,
  useVisibleComponents,
  useVisibleConnections,
  type Diagram,
} from "@/features/diagram";
import "@/features/canvas/nodes/node-types/registry";
import { FlowModeProvider } from "../flow/FlowModeContext";
import { EMPTY_FLOW_HIGHLIGHT } from "../flow/flowState";
import { resolveNodeDescriptor } from "../nodes/node-types";
import { resolveViewSnapshot } from "../core/resolveViewSnapshot";
import { useCanvasConnectionDerivations } from "./useCanvasConnectionDerivations";
import { useCanvasEdges } from "./useCanvasEdges";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

/**
 * Which edges hand React Flow a new `data` object after a store write.
 *
 * Slice 6 of docs/investigation/divergencia-edicao-visualizacao.md moves the
 * editor's resting edge geometry from the store onto `data`, as the viewer
 * already has it. That is only safe if a write that is not about an edge
 * leaves that edge's `data` — and so the edge object React Flow holds — alone:
 * otherwise every store write re-renders every edge, and one mid-gesture could
 * reach the edge being dragged. This runs the editor's own chain (store
 * selectors → view → derivations → useCanvasEdges) against the real store and
 * counts, per write, the edges whose `data` and whose edge object changed.
 *
 * Set IDENTITY_OUT to a file path to record the counts.
 */

const latest: { edges: Edge[] } = { edges: [] };

function Harness() {
  const store = useDiagramStore();
  const diagram = store.diagrams[store.activeDiagramId!] as Diagram;
  const visibleComponents = useVisibleComponents();
  const visibleConnections = useVisibleConnections();
  const resolvedComponents = useResolvedComponents();
  const { edgeHandleAssignments } = useCanvasConnectionDerivations({
    visibleComponents,
    visibleConnections,
    resolvedComponents,
  });
  const view = resolveViewSnapshot(diagram, { sceneId: null }, resolveNodeDescriptor);
  latest.edges = useCanvasEdges({
    diagram,
    view,
    edgeHandleAssignments,
    selectedEdgeId: null,
    isPlaying: false,
    activeStep: null,
    flowHighlight: EMPTY_FLOW_HIGHLIGHT,
    flowBadges: null,
    coverage: null,
    visibleTags: null,
    visibleTagsKey: null,
  });
  return null;
}

/** Five nodes in a chain, four edges; edge A has waypoints and a label offset. */
function seed(): {
  diagramId: string;
  ids: Record<"A" | "B" | "C" | "D", string>;
  nodes: string[];
} {
  const s = useDiagramStore.getState();
  const diagram = s.addDiagram("Edge data identity", "container");
  s.openDiagram(diagram.id);
  const nodes = [0, 1, 2, 3, 4].map(
    (i) =>
      useDiagramStore.getState().addComponent("system", `n${i}`, null, { x: i * 300, y: 0 }).id,
  );
  const conn = (a: number, b: number, label: string) =>
    useDiagramStore.getState().addConnection(nodes[a]!, nodes[b]!, label)!.id;
  const ids = { A: conn(0, 1, "A"), B: conn(1, 2, "B"), C: conn(2, 3, "C"), D: conn(3, 4, "D") };
  useDiagramStore
    .getState()
    .setEdgeControlPoints(diagram.id, ids.A, [{ id: "p1", x: 150, y: -100 }]);
  useDiagramStore.getState().setEdgeLabelOffset(diagram.id, ids.A, 0.3);
  useDiagramStore
    .getState()
    .setEdgeControlPoints(diagram.id, ids.C, [{ id: "q1", x: 750, y: 120 }]);
  return { diagramId: diagram.id, ids, nodes };
}

function changedAfter(write: () => void): { data: string[]; edge: string[] } {
  const before = new Map(latest.edges.map((edge) => [edge.id, edge]));
  act(() => write());
  const data: string[] = [];
  const edge: string[] = [];
  for (const next of latest.edges) {
    const prev = before.get(next.id);
    if (prev?.data !== next.data) data.push(next.id);
    if (prev !== next) edge.push(next.id);
  }
  return { data, edge };
}

describe("edge data identity across store writes", () => {
  beforeEach(() => {
    useDiagramStore.setState({ diagrams: {}, activeDiagramId: null });
  });

  it("changes the data of no edge a write is not about", () => {
    const { diagramId, ids, nodes } = seed();
    render(
      <FlowModeProvider>
        <Harness />
      </FlowModeProvider>,
    );
    expect(latest.edges).toHaveLength(4);
    const name = (id: string) => Object.entries(ids).find(([, value]) => value === id)?.[0] ?? id;

    const writes = {
      "move edge A's waypoint": () =>
        useDiagramStore
          .getState()
          .setEdgeControlPoints(diagramId, ids.A, [{ id: "p1", x: 170, y: -140 }]),
      "move edge A's label": () =>
        useDiagramStore.getState().setEdgeLabelOffset(diagramId, ids.A, 0.6),
      "rename a node": () =>
        useDiagramStore.getState().updateComponent(nodes[2]!, { name: "renamed" }),
      "move a node": () =>
        useDiagramStore.getState().updateNodeLayout(nodes[4]!, { x: 1300, y: 40 }),
      "relabel edge B": () => useDiagramStore.getState().updateConnection(ids.B, { label: "B2" }),
    };

    const report: Record<string, { data: string[]; edge: string[] }> = {};
    for (const [label, write] of Object.entries(writes)) {
      const changed = changedAfter(write);
      report[label] = { data: changed.data.map(name), edge: changed.edge.map(name) };
    }
    if (process.env.IDENTITY_OUT) {
      appendFileSync(process.env.IDENTITY_OUT, JSON.stringify(report) + "\n");
    }

    // A write about edge A may touch A only; one about B, B only; one about
    // no edge, none.
    for (const label of ["move edge A's waypoint", "move edge A's label"]) {
      expect(report[label]!.data.filter((id) => id !== "A")).toEqual([]);
      expect(report[label]!.edge.filter((id) => id !== "A")).toEqual([]);
    }
    expect(report["rename a node"]).toEqual({ data: [], edge: [] });
    expect(report["move a node"]).toEqual({ data: [], edge: [] });
    expect(report["relabel edge B"]).toEqual({ data: ["B"], edge: ["B"] });
  });
});
