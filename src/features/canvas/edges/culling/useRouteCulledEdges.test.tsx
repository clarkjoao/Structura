import { act, renderHook } from "@testing-library/react";
import {
  ReactFlowProvider,
  useStoreApi,
  type Edge,
  type InternalNode,
  type Node,
} from "@xyflow/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  EDGE_CULLING_MIN_EDGES,
  EDGE_CULLING_RELEASE_MS,
  useRouteCulledEdges,
} from "./useRouteCulledEdges";

/**
 * The array React Flow receives: off-screen edges left out, the same array while
 * a pan stays inside its grid cell, and every edge object passed through as is.
 */
function internalNode(id: string, x: number, y: number): InternalNode<Node> {
  const node: Node = { id, position: { x, y }, data: {} };
  return {
    ...node,
    measured: { width: 200, height: 100 },
    internals: { positionAbsolute: { x, y }, z: 0, userNode: node },
  };
}

const NEAR = [internalNode("n1", 100, 100), internalNode("n2", 600, 300)];
const FAR = [internalNode("f1", 30000, 30000), internalNode("f2", 31000, 30000)];

function edgesOf(count: number): Edge[] {
  const edges: Edge[] = [];
  for (let i = 0; i < count; i += 1) {
    const near = i % 2 === 0;
    edges.push({ id: `e${i}`, source: near ? "n1" : "f1", target: near ? "n2" : "f2" });
  }
  return edges;
}

function setup(edges: Edge[]) {
  let api: ReturnType<typeof useStoreApi> | null = null;
  const wrapper = ({ children }: { children: ReactNode }) => (
    <ReactFlowProvider>{children}</ReactFlowProvider>
  );
  const hook = renderHook(
    (props: { edges: Edge[] }) => {
      api = useStoreApi();
      return useRouteCulledEdges(props.edges);
    },
    { wrapper, initialProps: { edges } },
  );
  act(() => {
    api!.setState({
      width: 1000,
      height: 800,
      transform: [0, 0, 1],
      nodeLookup: new Map([...NEAR, ...FAR].map((n) => [n.id, n])),
    });
  });
  return {
    hook,
    pan: (x: number, y: number) => act(() => api!.setState({ transform: [x, y, 1] })),
  };
}

describe("useRouteCulledEdges", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("leaves out the edges far from the viewport and passes the others through as is", () => {
    const edges = edgesOf(EDGE_CULLING_MIN_EDGES + 100);
    const { hook } = setup(edges);
    const rendered = hook.result.current!;
    expect(rendered).toHaveLength(edges.length / 2);
    expect(rendered.every((edge) => edges.includes(edge))).toBe(true);
    expect(rendered.every((edge) => edge.source === "n1")).toBe(true);
  });

  it("keeps the same array while a pan stays inside its cell", () => {
    const { hook, pan } = setup(edgesOf(EDGE_CULLING_MIN_EDGES + 100));
    const first = hook.result.current;
    pan(-30, -20);
    expect(hook.result.current).toBe(first);
  });

  it("mounts new edges at once and unmounts the old ones once the viewport settles", () => {
    const edges = edgesOf(EDGE_CULLING_MIN_EDGES + 100);
    const { hook, pan } = setup(edges);
    pan(-30500, -30000);
    // Mid-gesture the mounted set only grows: nothing is torn down yet.
    expect(hook.result.current).toBe(edges);

    act(() => {
      vi.advanceTimersByTime(EDGE_CULLING_RELEASE_MS);
    });
    expect(hook.result.current).toEqual(edges.filter((edge) => edge.source === "f1"));
  });

  it("does not report deleted edges as mounted", () => {
    const edges = edgesOf(EDGE_CULLING_MIN_EDGES + 100);
    const { hook } = setup(edges);
    const fewer = edges.filter((edge) => edge.id !== "e0");
    hook.rerender({ edges: fewer });
    expect(hook.result.current).toHaveLength(fewer.filter((edge) => edge.source === "n1").length);
    expect(hook.result.current!.some((edge) => edge.id === "e0")).toBe(false);
  });

  it("does not cull a small diagram", () => {
    const edges = edgesOf(EDGE_CULLING_MIN_EDGES - 1);
    const { hook } = setup(edges);
    expect(hook.result.current).toBe(edges);
  });
});
