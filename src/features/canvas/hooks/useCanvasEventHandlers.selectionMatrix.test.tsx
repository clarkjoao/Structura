import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, render, renderHook } from "@testing-library/react";
import { ReactFlowProvider, useStoreApi } from "@xyflow/react";
import type { Edge, Node } from "@xyflow/react";
import { useCanvasEventHandlers } from "./useCanvasEventHandlers";
import { useCanvasVisualState, type CanvasVisualState } from "./useCanvasVisualState";
import { useCanvasSelectionStore } from "./useCanvasSelectionStore";
import { dragSelectionRef } from "./useLocalNodes";
import { lockOverlay } from "../nodes/nodeOverlays";

vi.mock("sonner", () => ({
  toast: { warning: vi.fn(), error: vi.fn(), success: vi.fn(), info: vi.fn() },
}));

const recordNodeClick = vi.fn();
const recordEdgeClick = vi.fn();
const flowMode = { isRecording: false };
vi.mock("../flow/FlowModeContext", () => ({
  useFlowMode: () => ({
    isRecording: flowMode.isRecording,
    onRecordNodeClick: recordNodeClick,
    onRecordEdgeClick: recordEdgeClick,
  }),
}));

/**
 * The canvas controller's selection ring at jsdom level: the real visual state
 * (selection store + highlight + menus) feeding the real event handlers, with
 * the pointer funnel listening on `window` like it does in the app. Ports the
 * jsdom-reachable scenarios of cypress/e2e/selection-behavior-matrix.cy.ts.
 */
type Flow = ReturnType<typeof useStoreApi>;

interface Mounted {
  state: () => CanvasVisualState;
  handlers: () => ReturnType<typeof useCanvasEventHandlers>;
  flow: () => Flow;
  rerender: (props: Partial<HarnessProps>) => void;
}

interface HarnessProps {
  isPlaying: boolean;
  isCompareMode: boolean;
  isFlowPanelOpen: boolean;
}

function mount(initial: Partial<HarnessProps> = {}): Mounted {
  const held: {
    state: CanvasVisualState | null;
    handlers: ReturnType<typeof useCanvasEventHandlers> | null;
    flow: Flow | null;
  } = { state: null, handlers: null, flow: null };
  function Harness(props: HarnessProps) {
    const state = useCanvasVisualState(null);
    held.state = state;
    held.flow = useStoreApi();
    held.handlers = useCanvasEventHandlers({
      visualState: state,
      isPlaying: props.isPlaying,
      isCompareMode: props.isCompareMode,
      isFlowPanelOpen: props.isFlowPanelOpen,
      updateViewport: vi.fn(),
      addConnection: vi.fn(),
      screenToFlowPosition: (pos) => pos,
    });
    return null;
  }
  const props: HarnessProps = {
    isPlaying: false,
    isCompareMode: false,
    isFlowPanelOpen: false,
    ...initial,
  };
  const view = render(
    <ReactFlowProvider>
      <Harness {...props} />
    </ReactFlowProvider>,
  );
  return {
    state: () => held.state!,
    handlers: () => held.handlers!,
    flow: () => held.flow!,
    rerender: (next) =>
      view.rerender(
        <ReactFlowProvider>
          <Harness {...props} {...next} />
        </ReactFlowProvider>,
      ),
  };
}

const node = (id: string, extra: Partial<Node> = {}): Node => ({
  id,
  type: "system",
  position: { x: 0, y: 0 },
  data: {},
  ...extra,
});
const click = (modifiers: Partial<React.MouseEvent> = {}) =>
  ({ metaKey: false, ctrlKey: false, shiftKey: false, ...modifiers }) as React.MouseEvent;

const ids = () => [...useCanvasSelectionStore.getState().selectedNodeIds].sort();
const primary = () => useCanvasSelectionStore.getState().selectedNodeId;

// DOM the funnel resolves its targets from.
function nodeElement(id: string, inner?: "panel-body" | "panel-header"): HTMLElement {
  const el = document.createElement("div");
  el.className = "react-flow__node";
  el.setAttribute("data-id", id);
  const part = document.createElement("div");
  if (inner) part.className = inner;
  el.appendChild(part);
  document.body.appendChild(el);
  return part;
}
function paneElement(): HTMLElement {
  const el = document.createElement("div");
  el.className = "react-flow__pane";
  document.body.appendChild(el);
  return el;
}
function fire(
  target: Element,
  type: string,
  init: { shift?: boolean; ctrl?: boolean; x?: number; y?: number; button?: number } = {},
) {
  act(() => {
    target.dispatchEvent(
      new MouseEvent(type, {
        bubbles: true,
        button: init.button ?? 0,
        shiftKey: init.shift,
        ctrlKey: init.ctrl,
        clientX: init.x ?? 10,
        clientY: init.y ?? 10,
      }),
    );
  });
}
const press = (target: Element, init: Parameters<typeof fire>[2] = {}) => {
  fire(target, "pointerdown", init);
  fire(target, "pointerup", init);
};

/** React Flow reports the selection its store holds; a report it no longer holds is dropped. */
function holdInReactFlow(flow: Flow, selected: string[]) {
  flow.getState().setNodes(
    ["a", "b", "c", "panel"].map((id) => ({
      ...node(id),
      selected: selected.includes(id),
    })),
  );
}
const report = (selected: string[]) => ({
  nodes: selected.map((id) => node(id, { selected: true })),
  edges: [] as Edge[],
});

beforeEach(() => {
  useCanvasSelectionStore.getState().clearSelection();
  flowMode.isRecording = false;
  recordNodeClick.mockClear();
  recordEdgeClick.mockClear();
});
afterEach(() => {
  document.body.innerHTML = "";
  dragSelectionRef.selectionWrittenByFunnel = false;
  dragSelectionRef.isDragging = false;
  dragSelectionRef.selectedBeforeDrag.clear();
  useCanvasSelectionStore.getState().clearSelection();
});

describe("basic clicks (matrix: Cliques básicos)", () => {
  it("a click on a loose node selects it, set and primary together", () => {
    const m = mount();
    act(() => m.handlers().onNodeClick(click(), node("a")));
    expect(ids()).toEqual(["a"]);
    expect(primary()).toBe("a");
  });

  it("a click on another node replaces the selection", () => {
    const m = mount();
    act(() => m.handlers().onNodeClick(click(), node("a")));
    const b = nodeElement("b");
    press(b); // funnel replaces on pointerdown (decision #3)
    act(() => m.handlers().onNodeClick(click(), node("b")));
    expect(ids()).toEqual(["b"]);
    expect(primary()).toBe("b");
  });

  it("a click on a pane clears node, edge and highlight", () => {
    const m = mount();
    act(() => {
      m.handlers().onNodeClick(click(), node("a"));
      m.state().setHighlight("e1", ["a", "b"]);
    });
    act(() => m.handlers().onPaneClick());
    expect(ids()).toEqual([]);
    expect(primary()).toBeNull();
    expect(m.state().highlightedConnectionIds.size).toBe(0);
  });

  it("closePanel clears node and edge selection", () => {
    const m = mount();
    act(() => m.handlers().onEdgeClick({} as React.MouseEvent, { id: "e1" } as Edge));
    act(() => m.handlers().onNodeClick(click(), node("a")));
    act(() => m.handlers().closePanel());
    expect(ids()).toEqual([]);
    expect(useCanvasSelectionStore.getState().selectedEdgeId).toBeNull();
  });

  it("a node click and an edge click exclude each other", () => {
    const m = mount();
    act(() =>
      m.handlers().onEdgeClick(
        {} as React.MouseEvent,
        {
          id: "e1",
          source: "a",
          target: "b",
        } as Edge,
      ),
    );
    expect(useCanvasSelectionStore.getState().selectedEdgeId).toBe("e1");
    expect([...m.state().highlightedNodeIds].sort()).toEqual(["a", "b"]);

    act(() => m.handlers().onNodeClick(click(), node("a")));
    expect(useCanvasSelectionStore.getState().selectedEdgeId).toBeNull();
    expect(ids()).toEqual(["a"]);
    // 38ed79ea: the edge's highlight must not outlive the click that moved the selection.
    expect(m.state().highlightedConnectionIds.size).toBe(0);
    expect(m.state().highlightedNodeIds.size).toBe(0);
  });
});

describe("Shift/Cmd/Ctrl click (matrix: Ctrl+click adiciona à seleção)", () => {
  it.each([
    ["shift", { shift: true }, { shiftKey: true }],
    ["ctrl", { ctrl: true }, { ctrlKey: true }],
  ])("a %s click adds to the selection exactly once", (_name, funnelInit, clickInit) => {
    // ac72766c: a Shift/Cmd click toggles its node exactly once.
    const m = mount();
    act(() => m.handlers().onNodeClick(click(), node("a")));
    const b = nodeElement("b");

    // A real browser fires pointerdown and then its compatibility mousedown for one press.
    fire(b, "pointerdown", funnelInit);
    fire(b, "mousedown", funnelInit);
    expect(ids()).toEqual(["a", "b"]);
    fire(b, "pointerup", funnelInit);
    fire(b, "mouseup", funnelInit);

    // React Flow's click lands afterwards and must not undo the funnel's write.
    act(() => m.handlers().onNodeClick(click(clickInit), node("b")));
    expect(ids()).toEqual(["a", "b"]);
  });

  it("a second Shift click on a selected node removes it, again once", () => {
    const m = mount();
    act(() => useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(["a", "b"])));
    const b = nodeElement("b");
    fire(b, "pointerdown", { shift: true });
    fire(b, "mousedown", { shift: true });
    act(() => m.handlers().onNodeClick(click({ shiftKey: true }), node("b")));
    expect(ids()).toEqual(["a"]);
    expect(primary()).toBe("a");
  });

  it("a funnel-written press wins over React Flow's older report for the same press", () => {
    const m = mount();
    act(() => useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(["a"])));
    fire(nodeElement("b"), "pointerdown", { shift: true });
    expect(dragSelectionRef.selectionWrittenByFunnel).toBe(true);
    holdInReactFlow(m.flow(), ["a"]);
    act(() => m.handlers().onSelectionChange(report(["a"])));
    expect(ids()).toEqual(["a", "b"]);
  });
});

describe("panel interior (matrix H1b/H1c; decision #1)", () => {
  it("a click inside a panel's body clears the selection instead of selecting the panel", () => {
    const m = mount();
    act(() => m.handlers().onNodeClick(click(), node("a")));
    const body = nodeElement("panel", "panel-body");
    press(body);
    expect(ids()).toEqual([]);
    // The click React Flow raises for the same press is consumed: it must not select the panel.
    act(() => m.handlers().onNodeClick(click(), node("panel", { type: "panel" })));
    expect(ids()).toEqual([]);
  });

  it("a panel's forwarded pointerdown is the same press, so the interior click still clears", () => {
    // ac72766c: PanelNode dispatches a copy of the pointerdown on the pane to arm React Flow's
    // marquee; taken as a new press its `pane` target replaced the panel body's.
    const m = mount();
    act(() => m.handlers().onNodeClick(click(), node("a")));
    const body = nodeElement("panel", "panel-body");
    const pane = paneElement();
    fire(body, "pointerdown");
    fire(pane, "pointerdown"); // forwarded copy, same coordinates
    fire(body, "pointerup");
    expect(ids()).toEqual([]);
    expect(m.state().selectedNodeId).toBeNull();
  });

  it("a body drag past the threshold is not a click and keeps the selection", () => {
    const m = mount();
    act(() => m.handlers().onNodeClick(click(), node("a")));
    const body = nodeElement("panel", "panel-body");
    fire(body, "pointerdown", { x: 10, y: 10 });
    fire(body, "pointerup", { x: 60, y: 10 });
    expect(ids()).toEqual(["a"]);
  });

  it("a body click under the threshold (2 px) is still a click", () => {
    const m = mount();
    act(() => m.handlers().onNodeClick(click(), node("a")));
    const body = nodeElement("panel", "panel-body");
    fire(body, "pointerdown", { x: 10, y: 10 });
    fire(body, "pointerup", { x: 12, y: 10 });
    expect(ids()).toEqual([]);
  });

  it("a Shift click on the body is an additive gesture, not a background click", () => {
    const m = mount();
    act(() => m.handlers().onNodeClick(click(), node("a")));
    press(nodeElement("panel", "panel-body"), { shift: true });
    expect(ids()).toEqual(["a"]);
  });
});

describe("drag with a multi-selection (matrix: draw.io parity)", () => {
  it("dragging one member of a multi-selection keeps the others selected", () => {
    const m = mount();
    act(() => useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(["a", "b"])));
    dragSelectionRef.isDragging = true;
    dragSelectionRef.selectedBeforeDrag = new Set(["a", "b"]);
    holdInReactFlow(m.flow(), ["c"]);
    act(() => m.handlers().onSelectionChange(report(["c"])));
    expect(ids()).toEqual(["a", "b", "c"]);
    expect(dragSelectionRef.isDragging).toBe(false);
  });

  it("dragging an unselected node replaces the selection (decision #3)", () => {
    mount();
    act(() => useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(["a", "b"])));
    fire(nodeElement("c"), "pointerdown");
    expect(ids()).toEqual(["c"]);
    expect(primary()).toBe("c");
  });
});

describe("onSelectionChange keeps the store and React Flow in step", () => {
  it("drops a stale report so the two selections cannot ping-pong", () => {
    // ac72766c: "drop stale React Flow selection reports so selection cannot ping-pong".
    const m = mount();
    holdInReactFlow(m.flow(), []); // React Flow already moved on to an empty selection
    act(() => m.handlers().onSelectionChange(report(["panel"])));
    expect(ids()).toEqual([]);
  });

  it("writes a fresh report as one selection: the set and its primary", () => {
    // 38ed79ea: "synchronize node selection state".
    const m = mount();
    holdInReactFlow(m.flow(), ["b", "a"]);
    act(() => m.handlers().onSelectionChange(report(["b", "a"])));
    expect(ids()).toEqual(["a", "b"]);
    expect(primary()).toBe("b");
    expect(useCanvasSelectionStore.getState().selectedNodeIds.has(primary()!)).toBe(true);
  });

  it("an empty report is a real deselection", () => {
    const m = mount();
    act(() => m.handlers().onNodeClick(click(), node("a")));
    holdInReactFlow(m.flow(), []);
    act(() => m.handlers().onSelectionChange(report([])));
    expect(ids()).toEqual([]);
    expect(primary()).toBeNull();
  });

  it("an identical report does not write a new Set (no render ping-pong)", () => {
    const m = mount();
    holdInReactFlow(m.flow(), ["a"]);
    act(() => m.handlers().onSelectionChange(report(["a"])));
    const first = useCanvasSelectionStore.getState().selectedNodeIds;
    act(() => m.handlers().onSelectionChange(report(["a"])));
    expect(useCanvasSelectionStore.getState().selectedNodeIds).toBe(first);
  });

  it("a report with nodes clears the edge selection and menus", () => {
    const m = mount();
    act(() => m.handlers().onEdgeClick({} as React.MouseEvent, { id: "e1" } as Edge));
    holdInReactFlow(m.flow(), ["a"]);
    act(() => m.handlers().onSelectionChange(report(["a"])));
    expect(useCanvasSelectionStore.getState().selectedEdgeId).toBeNull();
  });

  it("is ignored while comparing versions", () => {
    const m = mount({ isCompareMode: true });
    holdInReactFlow(m.flow(), ["a"]);
    act(() => m.handlers().onSelectionChange(report(["a"])));
    expect(ids()).toEqual([]);
  });
});

describe("clearing the connection highlight with the node selection", () => {
  it("clears the highlight when the selected node changes", () => {
    // 38ed79ea: "clear connection highlight when node selection changes".
    const { result } = renderHook(() => useCanvasVisualState(null));
    act(() => result.current.setHighlight("e1", ["a", "b"]));
    expect(result.current.highlightedConnectionIds.size).toBe(1);

    act(() => result.current.setSelectedNodeIds(new Set(["a"])));
    expect(result.current.selectedNodeId).toBe("a");
    expect(result.current.highlightedConnectionIds.size).toBe(0);
    expect(result.current.highlightedNodeIds.size).toBe(0);
  });

  it("keeps the highlight while the selected node stays the same", () => {
    const { result } = renderHook(() => useCanvasVisualState(null));
    act(() => result.current.setSelectedNodeIds(new Set(["a"])));
    act(() => result.current.setHighlight("e1", ["a", "b"]));
    act(() => result.current.setSelectedNodeIds(new Set(["a", "b"])));
    expect(result.current.selectedNodeId).toBe("a");
    expect(result.current.highlightedConnectionIds.size).toBe(1);
  });

  it("clearCanvasSelection clears highlight, selection and menus together", () => {
    const { result } = renderHook(() => useCanvasVisualState(null));
    act(() => {
      result.current.setSelectedNodeIds(new Set(["a"]));
      result.current.setHighlight("e1", ["a"]);
      result.current.setContextMenu({ x: 1, y: 1, elementId: "a" });
    });
    act(() => result.current.clearCanvasSelection());
    expect(ids()).toEqual([]);
    expect(result.current.highlightedConnectionIds.size).toBe(0);
    expect(result.current.contextMenu).toBeNull();
  });
});

describe("read-only and recording modes", () => {
  it.each([
    ["playing", { isPlaying: true }],
    ["comparing", { isCompareMode: true }],
    ["with the flows list open", { isFlowPanelOpen: true }],
  ])("a node click selects nothing while %s", (_name, props) => {
    const m = mount(props);
    act(() => m.handlers().onNodeClick(click(), node("a")));
    expect(ids()).toEqual([]);
  });

  it("an edge click selects nothing while the flows list is open", () => {
    const m = mount({ isFlowPanelOpen: true });
    act(() => m.handlers().onEdgeClick({} as React.MouseEvent, { id: "e1" } as Edge));
    expect(useCanvasSelectionStore.getState().selectedEdgeId).toBeNull();
  });

  it("recording: a node click records a step and leaves the selection alone", () => {
    flowMode.isRecording = true;
    const m = mount();
    act(() => m.handlers().onNodeClick(click(), node("a")));
    expect(recordNodeClick).toHaveBeenCalledWith("a");
    expect(ids()).toEqual([]);
  });

  it("recording: a panel or note click is not a step", () => {
    flowMode.isRecording = true;
    const m = mount();
    act(() => m.handlers().onNodeClick(click(), node("panel", { type: "panel" })));
    act(() => m.handlers().onNodeClick(click(), node("n", { type: "note" })));
    expect(recordNodeClick).not.toHaveBeenCalled();
  });

  it("recording: an edge click records the edge", () => {
    flowMode.isRecording = true;
    const m = mount();
    act(() =>
      m.handlers().onEdgeClick({} as React.MouseEvent, { id: "e1", sourceHandle: "h" } as Edge),
    );
    expect(recordEdgeClick).toHaveBeenCalledWith("e1", "h");
  });
});

describe("context menu and double click", () => {
  it("a short right press on an unselected node opens its menu and selects it", () => {
    const m = mount();
    holdInReactFlow(m.flow(), []);
    m.flow()
      .getState()
      .setNodes([node("a")]);
    press(nodeElement("a"), { button: 2 });
    expect(m.state().contextMenu?.elementId).toBe("a");
    expect(ids()).toEqual(["a"]);
  });

  it("a right press on a member of a multi-selection keeps the multi-selection", () => {
    const m = mount();
    act(() => useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(["a", "b"])));
    m.flow()
      .getState()
      .setNodes([node("a"), node("b")]);
    press(nodeElement("a"), { button: 2 });
    expect(ids()).toEqual(["a", "b"]);
  });

  it("a right press on the pane opens quick insert only with nothing selected", () => {
    const m = mount();
    press(paneElement(), { button: 2 });
    expect(m.state().quickInsert).not.toBeNull();

    act(() => m.state().setQuickInsert(null));
    act(() => useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(["a"])));
    press(paneElement(), { button: 2 });
    expect(m.state().quickInsert).toBeNull();
  });

  it("a double click on a node selects just that node", () => {
    const m = mount();
    act(() => useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(["a", "b"])));
    act(() => m.handlers().onNodeDoubleClick(click(), node("c")));
    expect(ids()).toEqual(["c"]);
  });

  it("a double click on an edge selects the edge and drops node selection", () => {
    const m = mount();
    act(() => useCanvasSelectionStore.getState().setSelectedNodeIds(new Set(["a"])));
    act(() => m.handlers().onEdgeDoubleClick({} as React.MouseEvent, { id: "e1" } as Edge));
    expect(ids()).toEqual([]);
    expect(useCanvasSelectionStore.getState().selectedEdgeId).toBe("e1");
  });

  it("an endpoint inside a group selects the group", () => {
    const m = mount();
    act(() =>
      m.handlers().onNodeClick(click(), node("ep", { type: "endpoint", parentId: "group" })),
    );
    expect(ids()).toEqual(["group"]);
  });
});

describe("locked nodes stay selectable", () => {
  it("lockOverlay stops the drag but not the selection, so Ctrl+C/V still copies it", () => {
    // 5cd0df8e: "keep locked nodes selectable so Ctrl+C/V copies them".
    const locked = lockOverlay(node("a", { selectable: true, draggable: true }), true);
    expect(locked.draggable).toBe(false);
    expect(locked.selectable).not.toBe(false);
  });
});
