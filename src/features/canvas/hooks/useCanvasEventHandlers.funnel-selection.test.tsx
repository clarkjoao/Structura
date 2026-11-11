import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import type { Node } from "@xyflow/react";
import { FlowModeProvider } from "../flow/FlowModeContext";
import type { CanvasVisualState } from "./useCanvasVisualState";
import { useCanvasEventHandlers } from "./useCanvasEventHandlers";
import { dragSelectionRef } from "./useLocalNodes";

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
 * React Flow reports the selection it holds through `onSelectionChange`. For a
 * press the pointer funnel already wrote (Shift/Cmd click), that report comes
 * from React Flow's own click handling, which may predate the write — it once
 * dropped the node the user had just added. The store wins for that press.
 */
describe("onSelectionChange while the pointer funnel owns the press", () => {
  afterEach(() => {
    dragSelectionRef.selectionWrittenByFunnel = false;
  });

  function mount() {
    const state = visualState();
    const held: { current: ReturnType<typeof useCanvasEventHandlers> | null } = { current: null };
    function Harness() {
      held.current = useCanvasEventHandlers({
        visualState: state,
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
    return { state, handlers: () => held.current! };
  }

  const report = (ids: string[]) => ({
    nodes: ids.map((id) => ({ id, position: { x: 0, y: 0 }, data: {}, selected: true }) as Node),
    edges: [],
  });

  it("does not write React Flow's report to the selection", () => {
    const { state, handlers } = mount();
    dragSelectionRef.selectionWrittenByFunnel = true;

    handlers().onSelectionChange(report(["a"]));

    expect(state.setSelectedNodeIds).not.toHaveBeenCalled();
    expect(state.setSelectedNodeId).not.toHaveBeenCalled();
  });

  it("writes it once the press is over", () => {
    const { state, handlers } = mount();

    handlers().onSelectionChange(report(["a"]));

    expect(state.setSelectedNodeIds).toHaveBeenCalled();
  });
});
