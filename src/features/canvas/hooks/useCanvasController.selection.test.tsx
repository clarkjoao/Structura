import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { ReactFlowProvider } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { useDiagramStore } from "@/features/diagram";
import { FlowModeProvider } from "../flow/FlowModeContext";
import { useCanvasController } from "./useCanvasController";
import { useCanvasSelectionStore } from "./useCanvasSelectionStore";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

/**
 * The controller wires visual state, the event handlers and the graph state
 * around one selection store. These run the whole chain on a real seeded
 * diagram, through the handlers React Flow is given.
 */
function wrapper({ children }: { children: ReactNode }) {
  return (
    <MemoryRouter>
      <ReactFlowProvider>
        <FlowModeProvider>{children}</FlowModeProvider>
      </ReactFlowProvider>
    </MemoryRouter>
  );
}

function seed(): { a: string; b: string; connection: string } {
  const store = useDiagramStore.getState();
  const diagram = store.addDiagram("Controller selection", "container");
  store.openDiagram(diagram.id);
  const a = useDiagramStore.getState().addComponent("system", "A", null).id;
  const b = useDiagramStore.getState().addComponent("system", "B", null).id;
  const connection = useDiagramStore.getState().addConnection(a, b, "calls")?.id ?? "";
  return { a, b, connection };
}

const node = (id: string): Node => ({ id, type: "system", position: { x: 0, y: 0 }, data: {} });
const ids = () => [...useCanvasSelectionStore.getState().selectedNodeIds].sort();

describe("useCanvasController selection", () => {
  beforeEach(() => {
    useCanvasSelectionStore.getState().clearSelection();
  });
  afterEach(() => {
    useCanvasSelectionStore.getState().clearSelection();
  });

  it("a node click opens the element panel on that element", () => {
    const { a } = seed();
    const { result } = renderHook(() => useCanvasController(), { wrapper });
    expect(result.current.isPanelOpen).toBe(false);

    act(() =>
      result.current.eventHandlers.onNodeClick({ shiftKey: false } as React.MouseEvent, node(a)),
    );

    expect(result.current.visualState.selectedNodeId).toBe(a);
    expect(result.current.isPanelOpen).toBe(true);
  });

  it("projects the selection into the nodes it hands to React Flow", () => {
    const { a, b } = seed();
    const { result } = renderHook(() => useCanvasController(), { wrapper });
    act(() => useCanvasSelectionStore.getState().setSelectedNodeIds(new Set([a])));
    const selected = (id: string) => result.current.nodes.find((n) => n.id === id)?.selected;
    expect(selected(a)).toBe(true);
    expect(selected(b)).toBeFalsy();
  });

  it("an edge click from an empty selection selects the edge and highlights its ends", () => {
    const { a, b, connection } = seed();
    const { result } = renderHook(() => useCanvasController(), { wrapper });

    act(() =>
      result.current.eventHandlers.onEdgeClick(
        {} as React.MouseEvent,
        {
          id: connection,
          source: a,
          target: b,
        } as Edge,
      ),
    );

    expect(result.current.visualState.selectedEdgeId).toBe(connection);
    expect([...result.current.visualState.highlightedNodeIds].sort()).toEqual([a, b].sort());
    expect(result.current.isPanelOpen).toBe(true);
  });

  // KNOWN BUG on current code (suspected, not fixed here): 38ed79ea added an effect that clears
  // the highlight whenever `selectedNodeId` changes. An edge click from a node selection sets
  // the highlight and then nulls `selectedNodeId` in the same batch, so the effect wipes the
  // highlight it was just given; the same click from an empty selection keeps it (test above).
  it.fails("an edge click from a node selection keeps the edge's highlight", () => {
    const { a, b, connection } = seed();
    const { result } = renderHook(() => useCanvasController(), { wrapper });
    act(() => useCanvasSelectionStore.getState().setSelectedNodeIds(new Set([a])));

    act(() =>
      result.current.eventHandlers.onEdgeClick(
        {} as React.MouseEvent,
        {
          id: connection,
          source: a,
          target: b,
        } as Edge,
      ),
    );

    expect(result.current.visualState.selectedEdgeId).toBe(connection);
    expect(ids()).toEqual([]);
    expect([...result.current.visualState.highlightedNodeIds].sort()).toEqual([a, b].sort());
  });

  it("clicking the pane closes the panel and clears everything", () => {
    const { a } = seed();
    const { result } = renderHook(() => useCanvasController(), { wrapper });
    act(() => result.current.eventHandlers.onNodeClick({} as React.MouseEvent, node(a)));
    act(() => result.current.eventHandlers.onPaneClick());
    expect(ids()).toEqual([]);
    expect(result.current.isPanelOpen).toBe(false);
  });

  it("opening another diagram clears the selection", () => {
    const { a } = seed();
    const { result } = renderHook(() => useCanvasController(), { wrapper });
    act(() => result.current.eventHandlers.onNodeClick({} as React.MouseEvent, node(a)));
    expect(ids()).toEqual([a]);

    act(() => {
      const store = useDiagramStore.getState();
      store.openDiagram(store.addDiagram("Other", "container").id);
    });

    expect(ids()).toEqual([]);
  });

  it("an inline note or JSON edit takes the panel's place while the node stays selected", () => {
    const { a } = seed();
    const { result } = renderHook(() => useCanvasController(), { wrapper });
    act(() => result.current.eventHandlers.onNodeClick({} as React.MouseEvent, node(a)));
    expect(result.current.isPanelOpen).toBe(true);
    act(() => result.current.visualState.setNoteInlineEditingId(a));
    expect(result.current.isPanelOpen).toBe(false);
    expect(result.current.visualState.selectedNodeId).toBe(a);
  });
});
