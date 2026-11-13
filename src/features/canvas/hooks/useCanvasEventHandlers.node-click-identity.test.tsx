import { describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import { FlowModeProvider } from "../flow/FlowModeContext";
import type { CanvasVisualState } from "./useCanvasVisualState";
import { useCanvasEventHandlers } from "./useCanvasEventHandlers";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

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

/**
 * React Flow passes `onNodeClick` to every node, and its `NodeWrapper` is not
 * memoised: a new identity re-renders every node on the canvas. It must survive
 * the Canvas re-renders that every store write causes, and still act on the
 * latest state.
 */
describe("onNodeClick identity", () => {
  it("is stable across re-renders and calls the latest handler", () => {
    const held: { current: ReturnType<typeof useCanvasEventHandlers> | null } = { current: null };
    let state = visualState();

    function Harness({ playing }: { playing: boolean }) {
      held.current = useCanvasEventHandlers({
        // A fresh visual state object per render, as the Canvas hands over.
        visualState: state,
        isPlaying: playing,
        isFlowPanelOpen: false,
        updateViewport: vi.fn(),
        addConnection: vi.fn(),
        screenToFlowPosition: (pos) => pos,
      });
      return null;
    }

    const tree = (playing: boolean) => (
      <ReactFlowProvider>
        <FlowModeProvider>
          <Harness playing={playing} />
        </FlowModeProvider>
      </ReactFlowProvider>
    );
    const { rerender } = render(tree(false));
    const first = held.current!.onNodeClick;

    state = visualState();
    rerender(tree(true));
    expect(held.current!.onNodeClick).toBe(first);

    // Playback is read-only: the latest closure must be the one that runs.
    first({} as React.MouseEvent, { id: "n1", position: { x: 0, y: 0 }, data: {} } as Node);
    expect(state.setSelectedNodeId).not.toHaveBeenCalled();

    rerender(tree(false));
    first({} as React.MouseEvent, { id: "n1", position: { x: 0, y: 0 }, data: {} } as Node);
    expect(state.setSelectedNodeId).toHaveBeenCalledWith("n1");
  });
});
