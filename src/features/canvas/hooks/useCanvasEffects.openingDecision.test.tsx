import { StrictMode, useLayoutEffect, type ReactNode } from "react";
import { renderHook } from "@testing-library/react";
import {
  ReactFlowProvider,
  useStoreApi,
  type InternalNode,
  type Node,
  type ReactFlowInstance,
} from "@xyflow/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDiagramStore, type Diagram } from "@/features/diagram";
import { useCanvasEffects } from "./useCanvasEffects";

type Viewport = { x: number; y: number; zoom: number };

const PANE = { width: 1000, height: 800 };

/** A node at (x, y) with a measured 100x50 box, shaped like React Flow's internal node. */
function internalNode(id: string, x: number, y: number): InternalNode<Node> {
  return {
    id,
    position: { x, y },
    data: {},
    measured: { width: 100, height: 50 },
    internals: { positionAbsolute: { x, y }, z: 0 },
  } as unknown as InternalNode<Node>;
}

/** `visible` nodes inside a 1000x800 pane at the identity transform, `hidden` far off screen. */
function nodesWith(visible: number, offscreen: number): InternalNode<Node>[] {
  return [
    ...Array.from({ length: visible }, (_, i) => internalNode(`in${i}`, 10 + i, 10)),
    ...Array.from({ length: offscreen }, (_, i) => internalNode(`out${i}`, 50_000 + i, 50_000)),
  ];
}

/** Seeds React Flow's store before the hook's effects run (child layout effects come first). */
function Seed({
  nodes,
  width,
  height,
}: {
  nodes: InternalNode<Node>[];
  width: number;
  height: number;
}) {
  const store = useStoreApi();
  useLayoutEffect(() => {
    store.setState({ nodeLookup: new Map(nodes.map((n) => [n.id, n])), width, height });
  }, [store, nodes, width, height]);
  return null;
}

function flowInstance() {
  return {
    fitView: vi.fn(() => Promise.resolve(true)),
    setViewport: vi.fn(() => Promise.resolve(true)),
    getViewport: vi.fn(() => ({ x: 0, y: 0, zoom: 1 })),
  };
}

let ids: string[] = [];

function putDiagram(id: string, viewport: Viewport | undefined) {
  ids.push(id);
  useDiagramStore.setState((state) => ({
    diagrams: { ...state.diagrams, [id]: { id, viewport } as Diagram },
  }));
}

function mount(
  diagramId: string,
  nodes: InternalNode<Node>[],
  options: { strict?: boolean; width?: number; height?: number } = {},
) {
  const flow = flowInstance();
  const wrapper = ({ children }: { children: ReactNode }) => {
    const tree = (
      <ReactFlowProvider>
        <Seed
          nodes={nodes}
          width={options.width ?? PANE.width}
          height={options.height ?? PANE.height}
        />
        {children}
      </ReactFlowProvider>
    );
    return options.strict ? <StrictMode>{tree}</StrictMode> : tree;
  };
  const view = renderHook(
    ({ id }: { id: string }) =>
      useCanvasEffects({
        diagram: { id } as Diagram,
        reactFlowInstance: flow as unknown as ReactFlowInstance,
        isPlaying: false,
        onClearSelection: () => {},
      }),
    { wrapper, initialProps: { id: diagramId } },
  );
  return { flow, ...view };
}

describe("useCanvasEffects: restore or fit on open", () => {
  let frames: FrameRequestCallback[] = [];
  /** Runs queued animation frames, including the ones they queue (the restore waits two). */
  const flushFrames = () => {
    while (frames.length > 0) {
      const batch = frames;
      frames = [];
      for (const cb of batch) cb(0);
    }
  };

  beforeEach(() => {
    frames = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => frames.push(cb));
    vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
    useDiagramStore.setState((state) => {
      const diagrams = { ...state.diagrams };
      for (const id of ids) delete diagrams[id];
      return { diagrams };
    });
    ids = [];
  });

  const SAVED: Viewport = { x: 0, y: 0, zoom: 1.5 };

  // ac72766c "fit the view when a restored viewport shows under 20% of the nodes", and
  // bac0981b "restore persisted viewport when opening a diagram".
  it.each([
    { name: "no viewport saved", viewport: undefined, visible: 5, off: 0, outcome: "fit" },
    {
      name: "the default viewport",
      viewport: { x: 0, y: 0, zoom: 1 },
      visible: 5,
      off: 0,
      outcome: "fit",
    },
    {
      name: "saved, all nodes in view",
      viewport: { x: 0, y: 0, zoom: 0.9 },
      visible: 5,
      off: 0,
      outcome: "restore",
    },
    {
      name: "saved, exactly 20% in view",
      viewport: { x: 0, y: 0, zoom: 0.9 },
      visible: 2,
      off: 8,
      outcome: "restore",
    },
    {
      name: "saved, 10% in view",
      viewport: { x: 0, y: 0, zoom: 0.9 },
      visible: 1,
      off: 9,
      outcome: "fit",
    },
    {
      name: "saved, none in view",
      viewport: { x: 0, y: 0, zoom: 0.9 },
      visible: 0,
      off: 6,
      outcome: "fit",
    },
    {
      name: "saved, empty diagram",
      viewport: { x: 30, y: 40, zoom: 0.9 },
      visible: 0,
      off: 0,
      outcome: "restore",
    },
  ])("$name: $outcome", ({ viewport, visible, off, outcome }) => {
    putDiagram("d", viewport);
    const { flow } = mount("d", nodesWith(visible, off));
    flushFrames();
    if (outcome === "fit") {
      expect(flow.fitView).toHaveBeenCalledTimes(1);
      expect(flow.setViewport).not.toHaveBeenCalled();
    } else {
      expect(flow.fitView).not.toHaveBeenCalled();
      expect(flow.setViewport).toHaveBeenCalledTimes(1);
      expect(flow.setViewport).toHaveBeenCalledWith(viewport, { duration: 0 });
    }
  });

  it("an unmeasured pane (0x0) is not read as 'mostly off screen': the saved viewport is restored", () => {
    putDiagram("d", SAVED);
    const { flow } = mount("d", nodesWith(0, 6), { width: 0, height: 0 });
    flushFrames();
    expect(flow.setViewport).toHaveBeenCalledTimes(1);
    expect(flow.fitView).not.toHaveBeenCalled();
  });

  it("restores only after two frames, so the nodes are in the store when occupancy is read", () => {
    putDiagram("d", SAVED);
    const { flow } = mount("d", nodesWith(3, 0));
    expect(flow.setViewport).not.toHaveBeenCalled();
    expect(frames).toHaveLength(1);
    frames.shift()!(0);
    expect(flow.setViewport).not.toHaveBeenCalled();
    flushFrames();
    expect(flow.setViewport).toHaveBeenCalledTimes(1);
  });

  // ac72766c "one owner of the opening fit": re-renders with the same diagram id (every store
  // write hands the canvas a new diagram object) must not fit again.
  it("fits exactly once across re-renders with the same diagram id", () => {
    putDiagram("d", undefined);
    const { flow, rerender } = mount("d", nodesWith(5, 0));
    rerender({ id: "d" });
    rerender({ id: "d" });
    flushFrames();
    expect(flow.fitView).toHaveBeenCalledTimes(1);
  });

  it("restores exactly once across re-renders, and a viewport saved meanwhile is not re-applied", () => {
    putDiagram("d", SAVED);
    const { flow, rerender } = mount("d", nodesWith(5, 0));
    rerender({ id: "d" });
    flushFrames();
    useDiagramStore.setState((state) => ({
      diagrams: { ...state.diagrams, d: { id: "d", viewport: { x: 5, y: 5, zoom: 2 } } as Diagram },
    }));
    rerender({ id: "d" });
    flushFrames();
    expect(flow.setViewport).toHaveBeenCalledTimes(1);
    expect(flow.fitView).not.toHaveBeenCalled();
  });

  it("under StrictMode the restore still lands once (the first run's frames are cancelled)", () => {
    putDiagram("d", SAVED);
    const cancel = vi.mocked(window.cancelAnimationFrame);
    // Cancelling drops the queued frame, as the browser does.
    cancel.mockImplementation((id) => {
      frames[id - 1] = () => {};
    });
    const { flow } = mount("d", nodesWith(5, 0), { strict: true });
    flushFrames();
    expect(flow.setViewport).toHaveBeenCalledTimes(1);
    expect(flow.fitView).not.toHaveBeenCalled();
  });

  // ac72766c: a different diagram opens on its own viewport, not the previous one's decision.
  it("switching diagrams decides again for the new one", () => {
    putDiagram("fresh", undefined);
    putDiagram("saved", SAVED);
    const { flow, rerender } = mount("fresh", nodesWith(5, 0));
    flushFrames();
    expect(flow.fitView).toHaveBeenCalledTimes(1);

    rerender({ id: "saved" });
    flushFrames();
    expect(flow.setViewport).toHaveBeenCalledTimes(1);
    expect(flow.setViewport).toHaveBeenCalledWith(SAVED, { duration: 0 });
    expect(flow.fitView).toHaveBeenCalledTimes(1);

    rerender({ id: "fresh" });
    flushFrames();
    expect(flow.fitView).toHaveBeenCalledTimes(2);
  });

  // ac72766c: the frames the old diagram queued must not apply its viewport to the new one,
  // whether the cancel reaches the browser (true) or the callback only checks its flag (false).
  it.each([{ cancelDrops: true }, { cancelDrops: false }])(
    "switching away before the two frames elapse drops the old diagram's restore ($cancelDrops)",
    ({ cancelDrops }) => {
      putDiagram("saved", SAVED);
      putDiagram("fresh", undefined);
      if (cancelDrops) {
        vi.mocked(window.cancelAnimationFrame).mockImplementation((id) => {
          frames[id - 1] = () => {};
        });
      }
      const { flow, rerender } = mount("saved", nodesWith(5, 0));
      rerender({ id: "fresh" });
      flushFrames();
      expect(flow.setViewport).not.toHaveBeenCalled();
      expect(flow.fitView).toHaveBeenCalledTimes(1);
    },
  );

  it("does nothing without a diagram", () => {
    const flow = flowInstance();
    renderHook(
      () =>
        useCanvasEffects({
          diagram: null,
          reactFlowInstance: flow as unknown as ReactFlowInstance,
          isPlaying: false,
          onClearSelection: () => {},
        }),
      { wrapper: ({ children }) => <ReactFlowProvider>{children}</ReactFlowProvider> },
    );
    flushFrames();
    expect(flow.fitView).not.toHaveBeenCalled();
    expect(flow.setViewport).not.toHaveBeenCalled();
  });

  it("skipInitialFit leaves the viewport alone", () => {
    putDiagram("d", undefined);
    const flow = flowInstance();
    renderHook(
      () =>
        useCanvasEffects({
          diagram: { id: "d" } as Diagram,
          reactFlowInstance: flow as unknown as ReactFlowInstance,
          isPlaying: false,
          onClearSelection: () => {},
          skipInitialFit: true,
        }),
      { wrapper: ({ children }) => <ReactFlowProvider>{children}</ReactFlowProvider> },
    );
    flushFrames();
    expect(flow.fitView).not.toHaveBeenCalled();
  });
});
