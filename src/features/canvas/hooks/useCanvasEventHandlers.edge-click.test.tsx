import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import type { Edge } from "@xyflow/react";
import { FlowModeProvider } from "../flow/FlowModeContext";
import type { CanvasVisualState } from "./useCanvasVisualState";
import { useCanvasEventHandlers } from "./useCanvasEventHandlers";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

/**
 * Canvas edge click must match ElementPanel → Connections: highlight the edge
 * and both endpoint nodes, not only select the edge.
 */

const setHighlight = vi.fn();
const clearHighlight = vi.fn();
const setSelectedEdgeId = vi.fn();

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

function clickEdge() {
  setHighlight.mockClear();
  clearHighlight.mockClear();
  setSelectedEdgeId.mockClear();
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

  const edge = { id: "conn-1", source: "a", target: "b" } as Edge;
  held.current!.onEdgeClick({} as React.MouseEvent, edge);
}

describe("onEdgeClick highlights edge and endpoints", () => {
  it("calls setHighlight with the connection and both node ids", () => {
    clickEdge();
    expect(clearHighlight).not.toHaveBeenCalled();
    expect(setHighlight).toHaveBeenCalledWith("conn-1", ["a", "b"]);
    expect(setSelectedEdgeId).toHaveBeenCalledWith("conn-1");
  });
});
