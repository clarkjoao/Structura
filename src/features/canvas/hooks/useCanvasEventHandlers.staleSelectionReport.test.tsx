import { useMemo } from "react";
import { act, render } from "@testing-library/react";
import {
  ReactFlow,
  ReactFlowProvider,
  useStoreApi,
  type InternalNode,
  type Node,
} from "@xyflow/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { FlowModeProvider } from "../flow/FlowModeContext";
import type { CanvasVisualState } from "./useCanvasVisualState";
import { useCanvasEventHandlers } from "./useCanvasEventHandlers";
import { useCanvasSelection } from "./useCanvasSelection";
import { useCanvasSelectionStore } from "./useCanvasSelectionStore";
import { isStaleSelectionReport } from "../selection/staleSelectionReport";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

const BASE_NODES: Node[] = [
  { id: "panel", position: { x: 0, y: 0 }, data: {} },
  { id: "a", position: { x: 300, y: 0 }, data: {} },
  { id: "b", position: { x: 600, y: 0 }, data: {} },
];

type FlowStore = ReturnType<typeof useStoreApi>;

/**
 * The editor's selection ring, as small as it gets: the selection store,
 * `selected` projected into controlled React Flow nodes, and React Flow's report
 * coming back through the real `onSelectionChange`.
 */
function Harness({
  onStore,
  onReport,
}: {
  onStore: (store: FlowStore) => void;
  onReport: () => void;
}) {
  const selection = useCanvasSelection(null);
  const visualState: CanvasVisualState = {
    ...selection,
    highlightedConnectionIds: new Set(),
    highlightedNodeIds: new Set(),
    setHighlight: vi.fn(),
    clearHighlight: vi.fn(),
    contextMenu: null,
    setContextMenu: vi.fn(),
    quickInsert: null,
    setQuickInsert: vi.fn(),
    paneContextMenu: null,
    setPaneContextMenu: vi.fn(),
    clearCanvasSelection: selection.clearSelection,
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
  const handlers = useCanvasEventHandlers({
    visualState,
    isPlaying: false,
    isFlowPanelOpen: false,
    updateViewport: vi.fn(),
    addConnection: vi.fn(),
    screenToFlowPosition: (pos) => pos,
  });
  const nodes = useMemo(
    () => BASE_NODES.map((n) => ({ ...n, selected: selection.selectedNodeIds.has(n.id) })),
    [selection.selectedNodeIds],
  );
  const store = useStoreApi();
  onStore(store);
  return (
    <ReactFlow
      nodes={nodes}
      edges={[]}
      onSelectionChange={(params) => {
        onReport();
        handlers.onSelectionChange(params);
      }}
    />
  );
}

function mount() {
  let store: FlowStore | null = null;
  const reports = { count: 0 };
  render(
    <div style={{ width: 800, height: 600 }}>
      <ReactFlowProvider>
        <FlowModeProvider>
          <Harness onStore={(s) => (store = s)} onReport={() => reports.count++} />
        </FlowModeProvider>
      </ReactFlowProvider>
    </div>,
  );
  return { flow: () => store!, reports };
}

const selectedInStore = () => [...useCanvasSelectionStore.getState().selectedNodeIds].sort();

/**
 * React #185 on a large marquee drag (audit R7). A marquee started inside a
 * selected container makes React Flow keep the container selected on its
 * internal node while the store is cleared. React Flow's selection listener
 * reports from an effect what it read at render, after its `StoreUpdater` has
 * already handed it the store's newer projection; writing that report back
 * swapped the two selections on every commit until React gave up.
 */
describe("onSelectionChange: React Flow and the store change selection together", () => {
  beforeEach(() => {
    useCanvasSelectionStore.getState().clearSelection();
  });
  afterEach(() => {
    useCanvasSelectionStore.getState().clearSelection();
  });

  it("settles instead of swapping the two selections forever", () => {
    const { flow, reports } = mount();
    act(() => {
      useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(["panel", "a", "b"]));
    });
    expect(selectedInStore()).toEqual(["a", "b", "panel"]);

    const before = reports.count;
    act(() => {
      // React Flow's selection rect: it unselects on its internal nodes and keeps the
      // container it started in...
      const lookup = flow().getState().nodeLookup;
      lookup.get("a")!.selected = false;
      lookup.get("b")!.selected = false;
      flow().setState({});
      // ...while the store is cleared by the change it reported for the same gesture.
      useCanvasSelectionStore.getState().clearSelection();
    });

    expect(reports.count - before).toBeLessThan(5);
    const live = [...flow().getState().nodeLookup.values()]
      .filter((n) => n.selected)
      .map((n) => n.id)
      .sort();
    expect(live).toEqual(selectedInStore());
  });
});

describe("isStaleSelectionReport", () => {
  const lookup = (selected: string[]) => {
    const map = new Map<string, InternalNode>();
    for (const n of BASE_NODES) {
      const isSelected = selected.includes(n.id);
      map.set(n.id, {
        ...n,
        selected: isSelected,
        measured: {},
        internals: { positionAbsolute: n.position, z: 0, userNode: { ...n, selected: isSelected } },
      });
    }
    return map;
  };

  it("is fresh when the report is what React Flow holds now", () => {
    expect(isStaleSelectionReport(["a", "panel"], lookup(["panel", "a"]))).toBe(false);
    expect(isStaleSelectionReport([], lookup([]))).toBe(false);
  });

  it("is stale when React Flow has moved past it", () => {
    expect(isStaleSelectionReport(["panel"], lookup([]))).toBe(true);
    expect(isStaleSelectionReport([], lookup(["panel"]))).toBe(true);
    expect(isStaleSelectionReport(["a"], lookup(["a", "b"]))).toBe(true);
  });
});
