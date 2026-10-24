import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import type { Node } from "@xyflow/react";
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

/** Double-clicking a node asks to work on it, so a folded inspector must unfold. */

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

describe("node double click", () => {
  it("unfolds a collapsed element panel", () => {
    useCanvasPreferencesStore.getState().setElementPanelCollapsed(true);
    const held: { current: ReturnType<typeof useCanvasEventHandlers> | null } = { current: null };

    function Harness() {
      held.current = useCanvasEventHandlers({
        visualState: visualState(),
        isPlaying: false,
        isFlowPanelOpen: false,
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

    held.current!.onNodeDoubleClick(
      {} as React.MouseEvent,
      { id: "n1", position: { x: 0, y: 0 }, data: {} } as Node,
    );
    expect(useCanvasPreferencesStore.getState().elementPanelCollapsed).toBe(false);
  });
});
