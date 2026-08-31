import { beforeAll, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ReactFlow, ReactFlowProvider, type Edge, type Node } from "@xyflow/react";
import type { Component, Connection, NodeLayout } from "@/features/diagram";
import { createTestDiagramStore } from "@/features/diagram/store/test-utils";
import { layout } from "../layout/layoutEngine";
import { irToLayoutGraph } from "@/features/llm/ir/ir-to-layout-graph";
import { buildGeneratedGraphInputs } from "@/features/llm/ir/apply-ir";
import { REFERENCE_DIAGRAMS } from "../layout/reference-diagrams";
import { GENERATED_DIAGRAMS } from "../layout/generated-diagrams";
import { NODE_TYPE_REGISTRY, resolveNodeDescriptor } from "../nodes/node-types";
import type { NodeBuildContext } from "../nodes/node-types/types";
import {
  buildConnectionCountPerNode,
  buildEdgeHandleAssignments,
  buildEffectiveHandleOrder,
  buildPanelIds,
} from "./connectionDerivations";
import type { DiagramIR } from "@/features/llm/ir/ir.types";

/**
 * The invariant: **an IR edge either reaches the DOM or it is not silent.**
 *
 * This is the durable half of the container-edge fix. Giving `PanelNode` handles
 * closes one case; this closes the class, because it fails for any future node
 * type whose rendered handles disagree with the slot `buildEdgeHandleAssignments`
 * reaches for. That disagreement is React Flow error #008, and its symptom is a
 * connection that is simply absent from the picture.
 *
 * Measured while writing this file, and the reason the console is not the guard:
 * with `PanelNode`'s handles removed, this harness renders **11 of B-run1's 27
 * edges** — the same 11 the real browser rendered in Fatia 1 — and React Flow
 * emits **no warning at all** in jsdom. In Chrome it at least logs #008. Here the
 * edge just is not there. So the load-bearing assertions are the DOM edge count
 * and the handle-id agreement; the console check below is a secondary signal
 * kept because it costs nothing, not because it caught anything.
 *
 * Hazard note (a known failure mode in this repo): React Flow renders **zero**
 * edges in jsdom unless nodes are measured, and a `ResizeObserver` stub whose
 * callback never fires leaves every assertion here passing over an empty canvas.
 * `renders any edges at all` exists so that cannot happen quietly.
 */

beforeAll(() => {
  // React Flow only draws an edge once both endpoints are measured. jsdom has no
  // layout, so the observer is stubbed to report a size the moment it is asked,
  // and every element reports the same box. The numbers are arbitrary; what
  // matters is that they are non-zero and stable.
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    private readonly cb: (entries: unknown[], self: unknown) => void;
    constructor(cb: (entries: unknown[], self: unknown) => void) {
      this.cb = cb;
    }
    observe(element: Element): void {
      this.cb([{ target: element, contentRect: { width: 200, height: 100 } }], this);
    }
    unobserve(): void {}
    disconnect(): void {}
  };
  (globalThis as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly = class {
    m22 = 1;
  };
  const rect = {
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 200,
    bottom: 100,
    width: 200,
    height: 100,
    toJSON() {},
  };
  HTMLElement.prototype.getBoundingClientRect = () => rect as DOMRect;
  Object.defineProperties(HTMLElement.prototype, {
    offsetWidth: { get: () => 200, configurable: true },
    offsetHeight: { get: () => 100, configurable: true },
  });
});

interface RenderedDiagram {
  /** Handle ids present in the DOM, per node id. */
  handlesByNode: Map<string, Set<string>>;
  /** Connection ids that produced a `.react-flow__edge` element. */
  domEdgeIds: Set<string>;
  connections: Connection[];
  components: Record<string, Component>;
  assignments: ReturnType<typeof buildEdgeHandleAssignments>;
  warnings: string[];
}

/**
 * Builds the context the descriptors read. Only the fields they actually touch
 * carry meaning; the rest are the empty values a fresh diagram has. Going through
 * the real `buildData` is the point — a descriptor that stops passing its handle
 * counts is the other way this invariant can break, and a hand-built `data`
 * object would hide it.
 */
function buildContext(
  components: Record<string, Component>,
  connections: Connection[],
  nodeLayouts: Record<string, NodeLayout>,
): NodeBuildContext {
  const counts = buildConnectionCountPerNode(connections);
  const assignments = buildEdgeHandleAssignments(connections, counts, components);
  const childrenIndex = new Map<string, Set<string>>();
  for (const component of Object.values(components)) {
    if (!component.parentId) continue;
    const siblings = childrenIndex.get(component.parentId) ?? new Set<string>();
    siblings.add(component.id);
    childrenIndex.set(component.parentId, siblings);
  }

  return {
    diagram: { id: "d", name: "d" },
    flows: [],
    resolvedComponents: components,
    resolvedNodeLayouts: nodeLayouts,
    sceneBadgeByComponentId: {},
    serviceCatalog: {},
    allDiagrams: {},
    selectedNodeId: null,
    selectedNodeIds: new Set<string>(),
    dragTargetPanelId: null,
    unparentCandidatePanelId: null,
    panelIds: buildPanelIds(Object.values(components)),
    connectionCounts: counts,
    effectiveHandleOrder: buildEffectiveHandleOrder(assignments, connections),
    isPlaying: false,
    isRecording: false,
    flowHighlight: {
      activeNodeId: null,
      activeConnId: null,
      visitedNodeIds: new Set<string>(),
      participantNodeIds: new Set<string>(),
      participantConnIds: new Set<string>(),
    },
    activeStep: null,
    recordingInfo: null,
    coverage: null,
    handleDrillDown: () => {},
    childrenIndex,
  } as unknown as NodeBuildContext;
}

/** Parents before children: React Flow needs the parent already in the list. */
function byDepth(nodes: Node[]): Node[] {
  const index = new Map(nodes.map((node, i) => [node.id, i]));
  const parentOf = new Map(nodes.map((node) => [node.id, node.parentId]));
  const depthOf = (id: string): number => {
    let depth = 0;
    let cursor = parentOf.get(id);
    while (cursor) {
      depth += 1;
      cursor = parentOf.get(cursor);
    }
    return depth;
  };
  return [...nodes].sort(
    (a, b) => depthOf(a.id) - depthOf(b.id) || index.get(a.id)! - index.get(b.id)!,
  );
}

/**
 * Seeds a diagram from an IR exactly as `applyIRToDiagram` does, then renders it
 * through the real node registry and the real handle assignment.
 */
async function renderIR(ir: DiagramIR): Promise<RenderedDiagram> {
  const store = createTestDiagramStore();
  const diagram = store.getState().addDiagram("invariant", "container");
  store.getState().openDiagram(diagram.id);

  const { boxes } = await layout(irToLayoutGraph(ir));
  const inputs = buildGeneratedGraphInputs(ir, boxes, { x: 0, y: 0 });
  store.getState().insertGeneratedGraph(inputs.nodes, inputs.edges);

  const seeded = store.getState().diagrams[diagram.id]!;
  const components = seeded.snapshot.components;
  const connections = Object.values(seeded.snapshot.connections) as Connection[];
  const nodeLayouts = seeded.nodeLayouts;

  const counts = buildConnectionCountPerNode(connections);
  const assignments = buildEdgeHandleAssignments(connections, counts, components);
  const ctx = buildContext(components, connections, nodeLayouts);

  const rfNodes: Node[] = Object.values(components).map((component) => {
    const descriptor = resolveNodeDescriptor(component);
    const nodeLayout = nodeLayouts[component.id];
    const width = nodeLayout?.width ?? 180;
    const height = nodeLayout?.height ?? 80;
    return {
      id: component.id,
      type: descriptor.rfType,
      position: { x: nodeLayout?.x ?? 0, y: nodeLayout?.y ?? 0 },
      width,
      height,
      measured: { width, height },
      ...(component.parentId ? { parentId: component.parentId } : {}),
      data: descriptor.buildData(component, ctx),
    } as Node;
  });

  const assignmentById = new Map(assignments.map((a) => [a.connId, a]));
  const rfEdges: Edge[] = connections.map((connection) => ({
    id: connection.id,
    source: connection.sourceId,
    target: connection.targetId,
    sourceHandle: assignmentById.get(connection.id)?.sourceHandle,
    targetHandle: assignmentById.get(connection.id)?.targetHandle,
  }));

  const warnings: string[] = [];
  const warnSpy = vi.spyOn(console, "warn").mockImplementation((...args: unknown[]) => {
    warnings.push(args.map(String).join(" "));
  });
  const nodeTypes = Object.fromEntries(NODE_TYPE_REGISTRY.map((d) => [d.rfType, d.component]));
  const { container } = render(
    <MemoryRouter>
      <ReactFlowProvider>
        <div style={{ width: 4000, height: 4000 }}>
          <ReactFlow nodes={byDepth(rfNodes)} edges={rfEdges} nodeTypes={nodeTypes} />
        </div>
      </ReactFlowProvider>
    </MemoryRouter>,
  );
  warnSpy.mockRestore();

  const handlesByNode = new Map<string, Set<string>>();
  for (const element of container.querySelectorAll(".react-flow__node")) {
    const id = element.getAttribute("data-id");
    if (id === null) continue;
    handlesByNode.set(
      id,
      new Set(
        [...element.querySelectorAll(".react-flow__handle")]
          .map((handle) => handle.getAttribute("data-handleid"))
          .filter((handleId): handleId is string => handleId !== null),
      ),
    );
  }

  const domEdgeIds = new Set(
    [...container.querySelectorAll(".react-flow__edge")]
      .map((element) => element.getAttribute("data-id"))
      .filter((id): id is string => id !== null),
  );

  return { handlesByNode, domEdgeIds, connections, components, assignments, warnings };
}

const ALL_DIAGRAMS = [...GENERATED_DIAGRAMS, ...REFERENCE_DIAGRAMS];

describe("every IR edge reaches the DOM", () => {
  it("renders any edges at all — without this the assertions below are vacuous", async () => {
    const { domEdgeIds, handlesByNode } = await renderIR(GENERATED_DIAGRAMS[3].ir);

    expect(domEdgeIds.size).toBeGreaterThan(0);
    expect([...handlesByNode.values()].reduce((sum, set) => sum + set.size, 0)).toBeGreaterThan(0);
  });

  it.each(ALL_DIAGRAMS.map((d) => [d.name, d.ir] as const))(
    "%s: every IR edge produces an edge element",
    async (name, ir) => {
      const { domEdgeIds, connections } = await renderIR(ir);

      // Counted against the IR, not against the connections, so a drop anywhere
      // on the way — the store insert, the applicator, the edge builder — fails
      // here too. Checking the DOM against the store's own connections would let
      // an edge lost before the store go unnoticed on both sides of the equals.
      expect(
        connections.length,
        `${name}: the store holds ${connections.length} connections for ${ir.edges.length} IR edges`,
      ).toBe(ir.edges.length);

      const missing = connections.filter((connection) => !domEdgeIds.has(connection.id));
      expect(
        missing.length,
        `${name}: ${missing.length} of ${connections.length} connections never reached the DOM`,
      ).toBe(0);
      expect(domEdgeIds.size).toBe(ir.edges.length);
    },
  );

  it.each(ALL_DIAGRAMS.map((d) => [d.name, d.ir] as const))(
    "%s: every assigned handle exists on the node that renders it",
    async (name, ir) => {
      const { handlesByNode, connections, components, assignments } = await renderIR(ir);

      const connectionById = new Map(connections.map((c) => [c.id, c]));
      const violations: string[] = [];
      for (const assignment of assignments) {
        const connection = connectionById.get(assignment.connId);
        if (connection === undefined) continue;
        const source = handlesByNode.get(connection.sourceId);
        const target = handlesByNode.get(connection.targetId);
        if (!source?.has(assignment.sourceHandle)) {
          violations.push(
            `${components[connection.sourceId]?.type} node is missing ${assignment.sourceHandle}`,
          );
        }
        if (!target?.has(assignment.targetHandle)) {
          violations.push(
            `${components[connection.targetId]?.type} node is missing ${assignment.targetHandle}`,
          );
        }
      }

      expect(violations, `${name}:\n${[...new Set(violations)].join("\n")}`).toHaveLength(0);
    },
  );

  /**
   * Secondary. React Flow logs `error#008` in Chrome when it refuses an edge, and
   * that log is what made the defect findable in Fatia 1 — but it was measured
   * NOT to fire in jsdom even with 16 edges dropped, so it guards nothing today.
   * Kept for the day a React Flow version starts warning here too.
   */
  it("logs no React Flow #008 while rendering a container-heavy diagram", async () => {
    const { warnings } = await renderIR(GENERATED_DIAGRAMS[3].ir);

    const eightHundredAndEight = warnings.filter(
      (warning) => warning.includes("error#008") || warning.includes("Couldn't create edge"),
    );
    expect(eightHundredAndEight).toHaveLength(0);
  });
});
