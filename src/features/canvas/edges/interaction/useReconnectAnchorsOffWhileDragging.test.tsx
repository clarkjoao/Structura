import { act, renderHook } from "@testing-library/react";
import { ReactFlowProvider, useStoreApi } from "@xyflow/react";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { useReconnectAnchorsOffWhileDragging } from "./useReconnectAnchorsOffWhileDragging";

const wrapper = ({ children }: { children: ReactNode }) => (
  <ReactFlowProvider>{children}</ReactFlowProvider>
);

function setup() {
  return renderHook(
    () => ({ anchors: useReconnectAnchorsOffWhileDragging(), store: useStoreApi() }),
    { wrapper },
  );
}

describe("useReconnectAnchorsOffWhileDragging", () => {
  it("drops the anchors for the drag and restores them when it ends", () => {
    const { result } = setup();
    expect(result.current.store.getState().edgesReconnectable).toBe(true);

    act(() => result.current.anchors.onNodeDragStart());
    expect(result.current.store.getState().edgesReconnectable).toBe(false);

    act(() => result.current.anchors.onNodeDragStop());
    expect(result.current.store.getState().edgesReconnectable).toBe(true);
  });

  it("leaves a canvas without reconnecting as it was", () => {
    const { result } = setup();
    act(() => result.current.store.setState({ edgesReconnectable: false }));

    act(() => result.current.anchors.onNodeDragStart());
    act(() => result.current.anchors.onNodeDragStop());

    expect(result.current.store.getState().edgesReconnectable).toBe(false);
  });

  it("restores once when a drag start is reported twice", () => {
    const { result } = setup();
    act(() => result.current.anchors.onNodeDragStart());
    act(() => result.current.anchors.onNodeDragStart());
    act(() => result.current.anchors.onNodeDragStop());
    expect(result.current.store.getState().edgesReconnectable).toBe(true);
  });

  it("keeps its callbacks across renders", () => {
    const { result, rerender } = setup();
    const first = result.current.anchors;
    rerender();
    expect(result.current.anchors).toBe(first);
  });
});
