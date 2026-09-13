import { act, render } from "@testing-library/react";
import { useCallback, useRef } from "react";
import {
  ReactFlow,
  ReactFlowProvider,
  useStoreApi,
  type Node,
  type NodeChange,
  type OnNodesChange,
} from "@xyflow/react";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { useLocalNodes } from "./useLocalNodes";

/**
 * What a drag frame has to reach.
 *
 * React Flow is controlled here, so `triggerNodeChanges` only calls
 * `onNodesChange`; the nodes it renders change only when `setNodes` runs, which
 * `StoreUpdater` does when the `nodes` prop's identity changes. So the merged
 * array has to reach React Flow's store on every frame or the dragged node does
 * not move at all -- see "stops moving" below, which is what removing the tick
 * without a substitute looks like.
 *
 * Ticking a React state to re-render the Canvas is one way to get there, and it
 * re-runs the whole controller hook chain once per pointermove. Handing the
 * array to `setNodes` directly is the same call `StoreUpdater` would make,
 * without the render.
 */

beforeAll(() => {
  (globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = class {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  };
});

const STORE_NODES: Node[] = [
  { id: "a", position: { x: 0, y: 0 }, data: { label: "a" } },
  { id: "b", position: { x: 300, y: 0 }, data: { label: "b" } },
];

function dragFrame(x: number): NodeChange[] {
  return [{ id: "a", type: "position", position: { x, y: 0 }, dragging: true }];
}

interface HarnessProps {
  onChangeReady: (onNodesChange: OnNodesChange) => void;
  onRender?: () => void;
  withPublisher?: boolean;
}

function Harness({ onChangeReady, onRender, withPublisher = true }: HarnessProps) {
  const store = useStoreApi();
  const localNodesRef = useRef<Node[]>(STORE_NODES);
  const publish = useCallback(
    (next: Node[]) => {
      store.getState().setNodes(next);
    },
    [store],
  );
  const { nodes, onNodesChange } = useLocalNodes(
    STORE_NODES,
    () => {},
    localNodesRef,
    undefined,
    null,
    withPublisher ? publish : undefined,
  );
  onChangeReady(onNodesChange);
  onRender?.();
  return <ReactFlow nodes={nodes} onNodesChange={onNodesChange} />;
}

function mount(props: Omit<HarnessProps, "onChangeReady">) {
  let onNodesChange: OnNodesChange = () => {};
  render(
    <ReactFlowProvider>
      <Harness {...props} onChangeReady={(fn) => (onNodesChange = fn)} />
    </ReactFlowProvider>,
  );
  return {
    drag: (x: number) => act(() => onNodesChange(dragFrame(x))),
    transform: () =>
      (document.querySelector('.react-flow__node[data-id="a"]') as HTMLElement | null)?.style
        .transform ?? "",
  };
}

describe("a drag frame", () => {
  it("moves the node React Flow renders, during the gesture", () => {
    const canvas = mount({});
    expect(canvas.transform()).toContain("translate(0px");

    canvas.drag(200);

    expect(canvas.transform()).toContain("translate(200px");
  });

  it("reaches React Flow without re-rendering the canvas", () => {
    const onRender = vi.fn();
    const canvas = mount({ onRender });
    const rendersBeforeDrag = onRender.mock.calls.length;

    for (let x = 20; x <= 200; x += 20) canvas.drag(x);

    expect(canvas.transform()).toContain("translate(200px");
    expect(onRender.mock.calls.length - rendersBeforeDrag).toBe(0);
  });

  it("still ticks React when no publisher is given", () => {
    const onRender = vi.fn();
    const canvas = mount({ onRender, withPublisher: false });
    const rendersBeforeDrag = onRender.mock.calls.length;

    canvas.drag(200);

    expect(canvas.transform()).toContain("translate(200px");
    expect(onRender.mock.calls.length - rendersBeforeDrag).toBeGreaterThan(0);
  });
});
