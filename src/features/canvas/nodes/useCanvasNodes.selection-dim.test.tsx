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
 * The wiring between the rule and the canvas.
 *
 * `selectionDimOpacity` is tested on its own next door; this is about the one
 * call site that decides what to hand it. Getting that argument wrong puts the
 * selection back in charge during a flow, which is the whole defect.
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
  // Read the selection the way the canvas does, so clearing it elsewhere is
  // visible here — a prop would freeze it and hide exactly that.
  const selectedNodeId = useCanvasSelectionStore((state) => state.selectedNodeId);
  const selectedNodeIds = useCanvasSelectionStore((state) => state.selectedNodeIds);
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
    selectedNodeId,
    selectedNodeIds,
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

/** Renders the canvas for a two-node diagram and returns each node's opacity. */
function opacities(options: { isPlaying?: boolean; selected?: string[] } = {}) {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Dim", "context");
  store.openDiagram(diagram.id);
  useDiagramStore.setState((state) => ({
    diagrams: {
      ...state.diagrams,
      [diagram.id]: {
        ...state.diagrams[diagram.id]!,
        snapshot: {
          ...state.diagrams[diagram.id]!.snapshot,
          components: { a: component("a"), b: component("b") },
        },
      },
    },
  }));
  const selected = options.selected ?? [];
  useCanvasSelectionStore.getState().setSelectedNodeId(selected[0] ?? null);
  useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(selected));
  render(
    <FlowModeProvider>
      <Harness isPlaying={options.isPlaying ?? false} />
    </FlowModeProvider>,
  );
  return () =>
    Object.fromEntries(nodes.current.map((n) => [n.id, (n.style?.opacity as number) ?? null]));
}

describe("the canvas hands the rule the mode it is actually in", () => {
  beforeEach(() => {
    held.current = null;
    nodes.current = [];
    useCanvasSelectionStore.getState().clearSelection();
  });

  it("builds the nodes at all, so the opacities below mean something", () => {
    const read = opacities({ selected: ["a"] });

    expect(Object.keys(read())).toEqual(["a", "b"]);
  });

  it("dims the unselected node when no flow is open", () => {
    const read = opacities({ selected: ["a"] });

    expect(read()).toEqual({ a: null, b: 0.3 });
  });

  it("dims nothing when nothing is selected and no flow is open", () => {
    const read = opacities({ selected: [] });

    expect(read()).toEqual({ a: null, b: null });
  });

  it("stops the selection dimming while a flow is being read", () => {
    const read = opacities({ selected: ["a"], isPlaying: true });

    // The flow decides now; `b` is left to whatever the descriptor says.
    expect(read().b).not.toBe(0.3);
  });

  it("stops it while a flow is being recorded too", () => {
    const read = opacities({ selected: ["a"] });
    expect(read()).toEqual({ a: null, b: 0.3 });

    act(() => api.startRecording());

    expect(read().b).not.toBe(0.3);
    expect(api.isRecording).toBe(true);
  });

  it("gives the selection back the moment the recording ends", () => {
    const read = opacities({ selected: ["a"] });
    act(() => api.startRecording());
    expect(read().b).not.toBe(0.3);

    act(() => api.cancelRecording());

    // Cancelling clears the selection, so nothing is dimmed by it any more.
    expect(read()).toEqual({ a: null, b: null });
  });
});
