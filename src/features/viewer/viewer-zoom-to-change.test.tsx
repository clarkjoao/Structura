import { act, render } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactFlowInstance } from "@xyflow/react";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { registerBuiltInDiagramKinds } from "@/features/diagram-kinds/bootstrap";
import { createKindDiagram } from "@/features/diagram-kinds/actions";
import { ViewerCanvas } from "./components/ViewerCanvas";

type Size = { width?: number; height?: number } | undefined;

/** What the mocked React Flow reports as measured, by node id; absent id = not on the canvas. */
const hoisted = vi.hoisted(() => ({
  measured: new Map<string, { width?: number; height?: number } | undefined>(),
  fitView: (() => Promise.resolve(true)) as (...args: unknown[]) => Promise<boolean>,
  cache: new WeakMap<object, unknown>(),
}));

vi.mock("@xyflow/react", async (importOriginal) => {
  const real = await importOriginal<typeof import("@xyflow/react")>();
  return {
    ...real,
    ViewportPortal: ({ children }: { children: ReactNode }) => <>{children}</>,
    useReactFlow: () => {
      const instance = real.useReactFlow();
      // One stable wrapper per real instance: the hook's effects depend on its identity.
      if (!hoisted.cache.has(instance)) {
        hoisted.cache.set(instance, {
          ...instance,
          fitView: (...args: unknown[]) => hoisted.fitView(...args),
          getNode: (id: string) => (hoisted.measured.has(id) ? { id } : undefined),
          getInternalNode: (id: string) =>
            hoisted.measured.has(id) ? { id, measured: hoisted.measured.get(id) } : undefined,
        });
      }
      return hoisted.cache.get(instance) as ReactFlowInstance;
    },
  };
});

registerBuiltInDiagramKinds();

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
  (globalThis as unknown as { DOMMatrixReadOnly: unknown }).DOMMatrixReadOnly = class {
    m22 = 1;
  };
});

const framed = () =>
  vi
    .mocked(hoisted.fitView)
    .mock.calls.filter(([options]) => Boolean((options as { nodes?: unknown } | undefined)?.nodes));

function open(focus: { ids: readonly string[]; token: number } | null) {
  const created = createKindDiagram({ name: "Zoom to change", level: "context", kindId: "guided" });
  const diagram = useDiagramStore.getState().diagrams[created.diagram.id]!;
  const view = (f: typeof focus) => (
    <MemoryRouter>
      <ViewerCanvas diagram={diagram} showOpenInStructuraButton={false} focus={f} />
    </MemoryRouter>
  );
  const result = render(view(focus));
  return { ...result, refocus: (f: typeof focus) => result.rerender(view(f)) };
}

const advance = (ms: number) => act(() => void vi.advanceTimersByTime(ms));

// c5c03f6d "viewer: zoom to what changed once it is drawn": the update reaches the canvas a
// moment later, so framing must wait until every changed node is measured and its size holds.
describe("the viewer zooms to what changed once it is drawn", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    hoisted.measured.clear();
    hoisted.fitView = vi.fn(() => Promise.resolve(true)) as typeof hoisted.fitView;
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  const A: Size = { width: 100, height: 40 };

  it("frames the changed nodes that are on the canvas, skipping one that never arrived", () => {
    hoisted.measured.set("a", A);
    open({ ids: ["a", "b"], token: 1 });
    advance(50 * 5);
    // "b" never arrived: only "a" is on the canvas and holds still, so that is what is framed.
    expect(framed()).toHaveLength(1);
    expect(framed()[0]![0]).toMatchObject({ nodes: [{ id: "a" }] });
  });

  it("waits while a changed node is unmeasured", () => {
    hoisted.measured.set("a", A);
    hoisted.measured.set("b", undefined);
    open({ ids: ["a", "b"], token: 1 });
    advance(50 * 10);
    expect(framed()).toHaveLength(0);

    hoisted.measured.set("b", { width: 80, height: 30 });
    advance(50); // first reading of the new sizes
    expect(framed()).toHaveLength(0);
    advance(50); // sizes held for one tick
    expect(framed()).toHaveLength(1);
    expect(framed()[0]![0]).toMatchObject({ nodes: [{ id: "a" }, { id: "b" }] });
  });

  it("waits again when a node is measured at a new size, and frames once it settles", () => {
    hoisted.measured.set("a", A);
    open({ ids: ["a"], token: 1 });
    advance(50); // first signature
    hoisted.measured.set("a", { width: 240, height: 40 }); // measured again after an edit
    advance(50);
    expect(framed()).toHaveLength(0);
    advance(50);
    expect(framed()).toHaveLength(1);
  });

  it("frames once per token, and again for a new token", () => {
    hoisted.measured.set("a", A);
    const { refocus } = open({ ids: ["a"], token: 1 });
    advance(50 * 4);
    expect(framed()).toHaveLength(1);
    refocus({ ids: ["a"], token: 2 });
    advance(50 * 4);
    expect(framed()).toHaveLength(2);
  });

  it("frames nothing for an empty focus", () => {
    hoisted.measured.set("a", A);
    open({ ids: [], token: 1 });
    advance(50 * 4);
    expect(framed()).toHaveLength(0);
  });

  it("stops waiting when the viewer goes away", () => {
    hoisted.measured.set("a", undefined);
    const { unmount } = open({ ids: ["a"], token: 1 });
    advance(50);
    unmount();
    hoisted.measured.set("a", A);
    advance(50 * 10);
    expect(framed()).toHaveLength(0);
  });
});
