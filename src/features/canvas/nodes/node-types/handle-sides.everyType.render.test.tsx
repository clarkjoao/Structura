import { beforeAll, describe, expect, it, vi } from "vitest";
import { act, render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { ReactFlow, ReactFlowProvider, useStoreApi, type Node } from "@xyflow/react";
import { useEffect, type ReactNode } from "react";
import "@/features/elements/bootstrap";
import { allElements } from "@/features/elements/element.registry";
import type { Component, Connection } from "@/features/diagram";
import {
  buildConnectionCountPerNode,
  buildEdgeHandleAssignments,
  buildEffectiveHandleOrder,
  buildPanelIds,
} from "../../edges/connectionDerivations";
import { ReadingDirectionContext } from "../../contexts/ReadingDirectionContext";
import { HandleSidesSync } from "../../core/HandleSidesSync";
import { getNodeTypesSnapshot, resolveNodeDescriptor } from "./registry";
import { handleSides, type ReadingDirection } from "./handle-sides";
import type { NodeBuildContext } from "./types";

/**
 * Every registered node type, rendered, honours the declared reading direction
 * (ADR-0013): target handles only on the input side, source handles only on the
 * output side, the cross-axis pair (`verticalSides`) on the cross sides — in LR
 * and in TB, and after toggling LR -> TB on the same mount.
 *
 * Complements `handleSides.guard.test.ts` (static grep for `Position.*`), which
 * cannot see a side that is computed or passed down, and
 * `handle-spec.render.test.tsx`, which checks a hand-picked type list in one
 * direction at a time.
 *
 * Regressions: 322f0d25 "handles no longer slide when the reading direction
 * changes" and "re-measure handles when the reading direction changes"
 * (HandleSidesSync); 47d945a6 "declare each node type's handle set".
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

const SIDES = ["left", "right", "top", "bottom"] as const;
type Side = (typeof SIDES)[number];
type Kind = "target" | "source";

interface Rendered {
  /** node id -> "kind:handleId" -> side */
  byNode: Map<string, Map<string, Side>>;
}

const FAN = 2;

function fixture() {
  const types = allElements().map((element) => element.id);
  const components: Record<string, Component> = {};
  const connections: Connection[] = [];
  for (let i = 0; i < FAN; i += 1) {
    components[`peer-${i}`] = {
      id: `peer-${i}`,
      name: `peer-${i}`,
      type: "system",
      parentId: null,
    } as unknown as Component;
  }
  for (const type of types) {
    const id = `n-${type}`;
    components[id] = {
      id,
      name: id,
      type,
      parentId: null,
      columns: [{ id: "c1", name: "id", type: "uuid" }],
      jsonContent: "{}",
      method: "GET",
      path: "/x",
      handlers: [],
    } as unknown as Component;
    for (let i = 0; i < FAN; i += 1) {
      connections.push({ id: `${id}-o${i}`, sourceId: id, targetId: `peer-${i}` } as Connection);
      connections.push({ id: `${id}-i${i}`, sourceId: `peer-${i}`, targetId: id } as Connection);
    }
  }
  const counts = buildConnectionCountPerNode(connections);
  const assignments = buildEdgeHandleAssignments(connections, counts, components);
  const ctx = {
    diagram: { id: "d", name: "d" },
    flows: [],
    endpointCallsByRoute: new Map(),
    resolvedComponents: components,
    resolvedNodeLayouts: {},
    versionBadgeByComponentId: {},
    services: {},
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

  const nodes: Node[] = types.map((type, index) => {
    const comp = components[`n-${type}`];
    const descriptor = resolveNodeDescriptor(comp);
    return {
      id: comp.id,
      type: descriptor.rfType,
      position: { x: (index % 8) * 300, y: Math.floor(index / 8) * 200 },
      width: 200,
      height: 100,
      measured: { width: 200, height: 100 },
      data: descriptor.buildData(comp, ctx),
    };
  });
  return { types, components, nodes };
}

function collect(container: HTMLElement): Rendered {
  const byNode = new Map<string, Map<string, Side>>();
  for (const element of container.querySelectorAll(".react-flow__handle")) {
    const nodeId = element.getAttribute("data-nodeid");
    const handleId = element.getAttribute("data-handleid");
    const kind: Kind | undefined = element.classList.contains("source")
      ? "source"
      : element.classList.contains("target")
        ? "target"
        : undefined;
    const side = SIDES.find(
      (name) =>
        element.getAttribute("data-handlepos") === name ||
        element.classList.contains(`react-flow__handle-${name}`),
    );
    if (nodeId === null || kind === undefined || side === undefined) continue;
    const handles = byNode.get(nodeId) ?? new Map<string, Side>();
    handles.set(`${kind}:${handleId ?? ""}`, side);
    byNode.set(nodeId, handles);
  }
  return { byNode };
}

const probe: { store?: ReturnType<typeof useStoreApi> } = {};
function StoreProbe() {
  const store = useStoreApi();
  useEffect(() => {
    probe.store = store;
  }, [store]);
  return null;
}

function Harness({ direction, nodes }: { direction: ReadingDirection; nodes: Node[] }): ReactNode {
  return (
    <MemoryRouter>
      <ReactFlowProvider>
        <ReadingDirectionContext.Provider value={direction}>
          <div style={{ width: 800, height: 600 }}>
            <ReactFlow nodes={nodes} edges={[]} nodeTypes={getNodeTypesSnapshot()}>
              <HandleSidesSync direction={direction} />
              <StoreProbe />
            </ReactFlow>
          </div>
        </ReadingDirectionContext.Provider>
      </ReactFlowProvider>
    </MemoryRouter>
  );
}

function sideOf(kind: Kind, handleId: string, direction: ReadingDirection, cross: boolean): Side {
  const sides = handleSides(direction);
  if (cross) return (kind === "target" ? sides.crossInput : sides.crossOutput) as Side;
  return (kind === "target" ? sides.input : sides.output) as Side;
}

function assertDirection(rendered: Rendered, types: string[], direction: ReadingDirection): void {
  for (const type of types) {
    const handles = rendered.byNode.get(`n-${type}`) ?? new Map<string, Side>();
    const spec = resolveNodeDescriptor({ id: `n-${type}`, type } as Component).handles;
    for (const [key, side] of handles) {
      const [kind, handleId] = [
        key.slice(0, key.indexOf(":")) as Kind,
        key.slice(key.indexOf(":") + 1),
      ];
      const cross = handleId === "target-top" || handleId === "source-bottom";
      if (cross)
        expect(spec.verticalSides, `${type} ${key} is cross-axis but undeclared`).toBe(true);
      expect(side, `${type} ${key} in ${direction}`).toBe(sideOf(kind, handleId, direction, cross));
    }
  }
}

describe("every registered node type honours the reading direction", () => {
  const { types, nodes } = fixture();

  it("renders some handles for the types that declare any", () => {
    const { container, unmount } = render(<Harness direction="LR" nodes={nodes} />);
    const rendered = collect(container);
    unmount();
    const withHandles = types.filter((type) => {
      // `api-group` declares SPREAD_HANDLES yet is `connectable: false` and
      // draws none; only connectable types are expected to render handles.
      const descriptor = resolveNodeDescriptor({ id: `n-${type}`, type } as Component);
      return (
        descriptor.connectable !== false &&
        (descriptor.handles.incoming !== 0 || descriptor.handles.outgoing !== 0)
      );
    });
    expect(withHandles.length).toBeGreaterThan(5);
    for (const type of withHandles) {
      expect(
        rendered.byNode.get(`n-${type}`)?.size ?? 0,
        `${type} renders no handle`,
      ).toBeGreaterThan(0);
    }
  });

  it("puts targets on the input side and sources on the output side in LR and TB", () => {
    for (const direction of ["LR", "TB"] as const) {
      const { container, unmount } = render(<Harness direction={direction} nodes={nodes} />);
      assertDirection(collect(container), types, direction);
      unmount();
    }
  });

  // 322f0d25: toggling the direction on a live canvas must leave the same
  // handles a fresh render in the new direction has, and React Flow's measured
  // handle bounds must follow (HandleSidesSync re-measures).
  it("after LR -> TB on one mount, equals a fresh TB render and is re-measured", () => {
    vi.useFakeTimers({ toFake: ["requestAnimationFrame", "cancelAnimationFrame"] });
    try {
      const fresh = render(<Harness direction="TB" nodes={nodes} />);
      const expected = collect(fresh.container);
      fresh.unmount();

      const view = render(<Harness direction="LR" nodes={nodes} />);
      act(() => {
        vi.advanceTimersByTime(50);
      });
      view.rerender(<Harness direction="TB" nodes={nodes} />);
      act(() => {
        vi.advanceTimersByTime(50);
      });

      const toggled = collect(view.container);
      assertDirection(toggled, types, "TB");
      expect(toggled.byNode).toEqual(expected.byNode);

      // The store's measured bounds name the same sides as the DOM.
      const lookup = probe.store?.getState().nodeLookup;
      expect(lookup).toBeDefined();
      let checked = 0;
      for (const [nodeId, handles] of toggled.byNode) {
        const bounds = lookup?.get(nodeId)?.internals.handleBounds;
        for (const kind of ["source", "target"] as const) {
          for (const bound of bounds?.[kind] ?? []) {
            const side = handles.get(`${kind}:${bound.id ?? ""}`);
            expect(bound.position, `${nodeId} ${kind} ${bound.id} measured`).toBe(side);
            checked += 1;
          }
        }
      }
      expect(checked).toBeGreaterThan(0);
      view.unmount();
    } finally {
      vi.useRealTimers();
    }
  });
});
