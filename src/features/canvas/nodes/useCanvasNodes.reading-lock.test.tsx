import { beforeEach, describe, expect, it, vi } from "vitest";
import { useEffect } from "react";
import { act, render } from "@testing-library/react";
import type { Component, Diagram } from "@/features/diagram";
import { useDiagramStore } from "@/features/diagram";
import { useCanvasSelectionStore } from "../hooks/useCanvasSelectionStore";
import { FlowModeProvider, useFlowMode } from "../flow/FlowModeContext";
import type { FlowModeState } from "../flow/flowMode.types";
import { EMPTY_FLOW_HIGHLIGHT } from "../flow/flowState";
import { useCanvasNodes } from "./useCanvasNodes";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

/**
 * A flow being read leaves the diagram alone.
 *
 * `<ReactFlow>` is told `nodesDraggable` / `elementsSelectable` /
 * `nodesConnectable` for the canvas as a whole, but a node that states any of
 * those for itself outranks that — so the reading has to say it here too, on
 * every node it builds. It said nothing until this test, and a node could be
 * dragged into a new position mid-reading, saved on the way.
 */

const held: { current: FlowModeState | null } = { current: null };
const api = new Proxy({} as FlowModeState, {
  get: (_t, key) => {
    if (!held.current) throw new Error("the harness has not rendered yet");
    return Reflect.get(held.current, key);
  },
});

const nodes: { current: ReturnType<typeof useCanvasNodes> } = { current: [] };

function component(id: string): Component {
  return { id, name: id, type: "system", parentId: null } as unknown as Component;
}

function Harness({ isPlaying }: { isPlaying: boolean }) {
  const flowMode = useFlowMode();
  const store = useDiagramStore();
  const diagram = store.diagrams[store.activeDiagramId!] as Diagram;
  const resolved = diagram.snapshot.components;
  nodes.current = useCanvasNodes({
    diagram,
    diagramSceneState: null,
    flows: [],
    resolvedComponents: resolved,
    resolvedNodeLayouts: {},
    sceneBadgeByComponentId: {},
    visibleComponents: Object.values(resolved),
    panelIds: new Set(),
    selectedNodeId: null,
    selectedNodeIds: new Set(),
    highlightedNodeIds: new Set(),
    serviceCatalog: {},
    allDiagrams: store.diagrams as Record<string, Diagram>,
    handleDrillDown: () => {},
    handlePanelCollapseToggle: () => {},
    isPlaying,
    dragTargetPanelId: null,
    unparentCandidatePanelId: null,
    connectionCountPerNode: {},
    effectiveHandleOrder: {},
    flowHighlight: EMPTY_FLOW_HIGHLIGHT,
    activeStep: null,
    flowBadges: null,
    coverage: null,
    isViewingCoverage: false,
    isNodeHiddenByTagFilter: () => false,
    updateComponent: () => {},
  });
  useEffect(() => {
    held.current = flowMode;
  });
  return null;
}

/** Renders the canvas for a one-node diagram and reads that node's interaction flags. */
function canvas(options: { isPlaying?: boolean } = {}) {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Reading lock", "context");
  store.openDiagram(diagram.id);
  useDiagramStore.setState((state) => ({
    diagrams: {
      ...state.diagrams,
      [diagram.id]: {
        ...state.diagrams[diagram.id]!,
        snapshot: {
          ...state.diagrams[diagram.id]!.snapshot,
          components: { a: component("a") },
        },
      },
    },
  }));
  render(
    <FlowModeProvider>
      <Harness isPlaying={options.isPlaying ?? false} />
    </FlowModeProvider>,
  );
  return () => {
    const node = nodes.current.find((n) => n.id === "a")!;
    return {
      draggable: node.draggable,
      selectable: node.selectable,
      connectable: node.connectable,
      focusable: node.focusable,
    };
  };
}

describe("a node is inert while its flow is being read", () => {
  beforeEach(() => {
    held.current = null;
    nodes.current = [];
    useCanvasSelectionStore.getState().clearSelection();
  });

  it("leaves a node fully interactive with no flow open, so the assertions below mean something", () => {
    const read = canvas();

    expect(read()).toEqual({
      draggable: true,
      selectable: true,
      connectable: true,
      focusable: true,
    });
  });

  it("refuses the drag that would move it, and the save that follows", () => {
    const read = canvas({ isPlaying: true });

    expect(read().draggable).toBe(false);
  });

  it("refuses the selection that would open the quick actions over it", () => {
    const read = canvas({ isPlaying: true });

    expect(read().selectable).toBe(false);
  });

  it("refuses a new connection drawn from its handles", () => {
    const read = canvas({ isPlaying: true });

    expect(read().connectable).toBe(false);
  });

  it("takes itself out of the tab order, where the rail does the walking", () => {
    const read = canvas({ isPlaying: true });

    expect(read().focusable).toBe(false);
  });

  it("stays interactive while a flow is being recorded: that is where you click the elements", () => {
    const read = canvas();

    act(() => api.startRecording());

    expect(api.isRecording).toBe(true);
    expect(read()).toEqual({
      draggable: true,
      selectable: true,
      connectable: true,
      focusable: true,
    });
  });
});
