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

/**
 * Clicking a port selects the group it belongs to — a shortcut, because the
 * port itself has nothing to edit. Selecting is still editing, so the shortcut
 * has to answer to the same read-only gate as an ordinary node click, which it
 * did not: during a reading it was the one way left to put the quick-action bar
 * over an element.
 */

const setSelectedNodeId = vi.fn();
const setSelectedNodeIds = vi.fn();

function visualState(): CanvasVisualState {
  return {
    selectedNodeId: null,
    setSelectedNodeId,
    selectedNodeIds: new Set(),
    setSelectedNodeIds,
    selectedEdgeId: null,
    setSelectedEdgeId: vi.fn(),
    highlightedConnectionId: null,
    highlightedNodeIds: new Set(),
    setHighlight: vi.fn(),
    clearHighlight: vi.fn(),
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

const port: Node = {
  id: "port-1",
  type: "endpoint",
  parentId: "group-1",
  position: { x: 0, y: 0 },
  data: {},
};

/** Clicks a port and reports what the click did to the selection. */
function clickPort(options: { isPlaying?: boolean; isFlowPanelOpen?: boolean } = {}) {
  setSelectedNodeId.mockClear();
  setSelectedNodeIds.mockClear();
  const held: { current: ReturnType<typeof useCanvasEventHandlers> | null } = { current: null };

  function Harness() {
    held.current = useCanvasEventHandlers({
      visualState: visualState(),
      isPlaying: options.isPlaying ?? false,
      isFlowPanelOpen: options.isFlowPanelOpen ?? false,
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

  held.current!.onNodeClick({} as React.MouseEvent, port);
  return setSelectedNodeId.mock.calls.map(([id]) => id);
}

describe("clicking a port answers to the same gate as clicking an element", () => {
  it("selects the group it belongs to on an ordinary canvas", () => {
    expect(clickPort()).toEqual(["group-1"]);
  });

  it("selects nothing while a flow is being read", () => {
    expect(clickPort({ isPlaying: true })).toEqual([]);
  });

  it("selects nothing while the flow panel has the canvas", () => {
    expect(clickPort({ isFlowPanelOpen: true })).toEqual([]);
  });
});
