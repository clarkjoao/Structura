import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import { FlowModeProvider } from "../flow/FlowModeContext";
import type { CanvasVisualState } from "./useCanvasVisualState";
import { useCanvasPreferencesStore } from "../preferences/canvas-preferences.store";
import { useCanvasEventHandlers } from "./useCanvasEventHandlers";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const setHighlight = vi.fn();
const clearHighlight = vi.fn();
const setSelectedEdgeId = vi.fn();

/** A click on an element opens its inspector: a folded inspector unfolds on one click, not two. */

function visualState(): CanvasVisualState {
  return {
    selectedNodeId: null,
    setSelectedNodeId: vi.fn(),
    selectedNodeIds: new Set(),
    setSelectedNodeIds: vi.fn(),
    selectedEdgeId: null,
    setSelectedEdgeId,
    highlightedConnectionIds: new Set(),
    highlightedNodeIds: new Set(),
    setHighlight,
    clearHighlight,
    contextMenu: null,
    setContextMenu: vi.fn(),
    quickInsert: null,
    setQuickInsert: vi.fn(),
    paneContextMenu: null,
    setPaneContextMenu: vi.fn(),
    clearCanvasSelection: vi.fn(),
    visibleTags: null,
    toggleTag: vi.fn(),
    showAllTags: vi.fn(),
    showNoTags: vi.fn(),
    isNodeHiddenByTagFilter: () => false,
    noteInlineEditingId: null,
    setNoteInlineEditingId: vi.fn(),
    jsonViewerInlineEditingId: null,
    setJsonViewerInlineEditingId: vi.fn(),
  };
}

function mount(params: { isFlowPanelOpen?: boolean; onYieldFlowPanel?: () => void } = {}) {
  const held: { current: ReturnType<typeof useCanvasEventHandlers> | null } = { current: null };

  function Harness() {
    held.current = useCanvasEventHandlers({
      visualState: visualState(),
      isPlaying: false,
      isFlowPanelOpen: params.isFlowPanelOpen ?? false,
      onYieldFlowPanel: params.onYieldFlowPanel,
      updateViewport: vi.fn(),
      addConnection: vi.fn(),
      screenToFlowPosition: (pos) => pos,
    });
    return null;
  }

  render(
    <ReactFlowProvider>
      <FlowModeProvider>
        <Harness />
      </FlowModeProvider>
    </ReactFlowProvider>,
  );
  return held.current!;
}

const node = { id: "n1", position: { x: 0, y: 0 }, data: {} } as Node;
const edge = { id: "e1", source: "a", target: "b" } as Edge;
const click = { metaKey: false, ctrlKey: false, shiftKey: false } as React.MouseEvent;

describe("clicking an element unfolds a folded inspector", () => {
  beforeEach(() => useCanvasPreferencesStore.getState().setElementPanelCollapsed(true));

  it("on a node double click", () => {
    mount().onNodeDoubleClick(click, node);
    expect(useCanvasPreferencesStore.getState().elementPanelCollapsed).toBe(false);
  });

  it("on a single node click", () => {
    mount().onNodeClick(click, node);
    expect(useCanvasPreferencesStore.getState().elementPanelCollapsed).toBe(false);
  });

  it("on a single edge click", () => {
    mount().onEdgeClick(click, edge);
    expect(useCanvasPreferencesStore.getState().elementPanelCollapsed).toBe(false);
  });

  it("on a node click with the flows list open: the list yields and the inspector shows", () => {
    const onYieldFlowPanel = vi.fn();
    mount({ isFlowPanelOpen: true, onYieldFlowPanel }).onNodeClick(click, node);
    expect(onYieldFlowPanel).toHaveBeenCalled();
    expect(useCanvasPreferencesStore.getState().elementPanelCollapsed).toBe(false);
  });

  it("not on a modifier click, which only edits the selection", () => {
    mount().onNodeClick({ ...click, shiftKey: true } as React.MouseEvent, node);
    expect(useCanvasPreferencesStore.getState().elementPanelCollapsed).toBe(true);
  });
});
