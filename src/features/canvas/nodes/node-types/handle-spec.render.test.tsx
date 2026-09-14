import { beforeAll, describe, expect, it } from "vitest";
import { render } from "@testing-library/react";
import { ReactFlow, ReactFlowProvider, type Node } from "@xyflow/react";
import type { Component, Connection } from "@/features/diagram";
import { MAX_HANDLES } from "@/features/diagram";
import {
  buildConnectionCountPerNode,
  buildEdgeHandleAssignments,
  buildEffectiveHandleOrder,
  buildPanelIds,
} from "../../edges/connectionDerivations";
import { getNodeTypesSnapshot, resolveNodeDescriptor, handleSpecForType } from "./registry";
import type { NodeBuildContext } from "./types";

/**
 * What each corrected type actually renders, counted in the DOM.
 *
 * The companion file `handle-spec.test.ts` holds the assignment to the declared
 * spec. This one holds the *component* to it, which is the half that cannot be
 * checked by reading types: a `<Handle>` the assignment names and the node never
 * renders is React Flow error #008, and in jsdom the edge simply is not there —
 * no warning, no throw. So the count comes from the rendered DOM.
 *
 * Same jsdom staging as `edges/ir-edges-reach-the-dom.test.tsx`: React Flow
 * renders nothing measurable without a `ResizeObserver` that answers and a
 * non-zero bounding box.
 */

beforeAll(() => {
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

/** Only the fields the descriptors under test read; the rest are a fresh diagram's. */
function buildContext(
  components: Record<string, Component>,
  connections: Connection[],
): NodeBuildContext {
  const counts = buildConnectionCountPerNode(connections);
  const assignments = buildEdgeHandleAssignments(connections, counts, components);
  return {
    diagram: { id: "d", name: "d" },
    flows: [],
    endpointCallsByRoute: new Map(),
    resolvedComponents: components,
    resolvedNodeLayouts: {},
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
    flowBadges: null,
    coverage: null,
    handleDrillDown: () => {},
    childrenIndex: new Map(),
  } as unknown as NodeBuildContext;
}

/** One node of `type`, wired to `fan` peers on each side, rendered for real. */
function renderTypeWithFan(type: string, fan: number): Set<string> {
  const hub = {
    id: "hub",
    name: "hub",
    type,
    parentId: null,
    columns: [{ id: "c1", name: "id", type: "uuid" }],
    jsonContent: "{}",
    method: "GET",
    path: "/x",
    handlers: [],
  } as unknown as Component;

  const components: Record<string, Component> = { hub };
  const connections: Connection[] = [];
  for (let i = 0; i < fan; i += 1) {
    components[`peer-${i}`] = {
      id: `peer-${i}`,
      name: `peer-${i}`,
      type: "system",
      parentId: null,
    } as unknown as Component;
    connections.push({ id: `out-${i}`, sourceId: "hub", targetId: `peer-${i}` } as Connection);
    connections.push({ id: `in-${i}`, sourceId: `peer-${i}`, targetId: "hub" } as Connection);
  }

  const ctx = buildContext(components, connections);
  const descriptor = resolveNodeDescriptor(hub);
  const nodes: Node[] = [
    {
      id: "hub",
      type: descriptor.rfType,
      position: { x: 0, y: 0 },
      width: 200,
      height: 100,
      measured: { width: 200, height: 100 },
      data: descriptor.buildData(hub, ctx),
    },
  ];

  const { container } = render(
    <ReactFlowProvider>
      <div style={{ width: 800, height: 600 }}>
        <ReactFlow nodes={nodes} edges={[]} nodeTypes={getNodeTypesSnapshot()} />
      </div>
    </ReactFlowProvider>,
  );

  const rendered = new Set<string>();
  for (const element of container.querySelectorAll(".react-flow__handle")) {
    const id = element.getAttribute("data-handleid");
    if (id !== null) rendered.add(id);
  }
  return rendered;
}

const CORRECTED_TYPES = [
  "note",
  "json-viewer",
  "db-table",
  "external-element",
  "svg",
  "endpoint",
] as const;

describe("declared handles reach the DOM", () => {
  it.each(CORRECTED_TYPES)("%s renders exactly the handles it declares", (type) => {
    const spec = handleSpecForType(type);
    const rendered = renderTypeWithFan(type, MAX_HANDLES + 2);

    const sources = [...rendered].filter((id) => id.startsWith("source-"));
    const targets = [...rendered].filter((id) => !id.startsWith("source-"));

    expect(sources.sort(), `${type} source handles`).toEqual(
      Array.from({ length: spec.outgoing }, (_, i) => `source-${i}`),
    );

    if (spec.incoming === "shared") {
      expect(targets, `${type} target handles`).toEqual(["in-hub"]);
    } else {
      expect(targets.sort(), `${type} target handles`).toEqual(
        Array.from({ length: spec.incoming }, (_, i) => `target-${i}`),
      );
    }
  });

  it("no node renders more handles than MAX_HANDLES on a side", () => {
    for (const type of CORRECTED_TYPES) {
      const rendered = renderTypeWithFan(type, MAX_HANDLES + 2);
      const sources = [...rendered].filter((id) => id.startsWith("source-"));
      const targets = [...rendered].filter((id) => !id.startsWith("source-"));
      expect(sources.length, `${type} sources`).toBeLessThanOrEqual(MAX_HANDLES);
      expect(targets.length, `${type} targets`).toBeLessThanOrEqual(MAX_HANDLES);
    }
  });
});
