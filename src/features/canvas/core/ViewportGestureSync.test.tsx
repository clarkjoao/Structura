import { useLayoutEffect } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import { ReactFlowProvider, useStoreApi } from "@xyflow/react";
import { VIEWPORT_REST_MS, ViewportGestureSync } from "./ViewportGestureSync";

const VIEWPORT = { x: 0, y: 0, zoom: 1 };
type FlowStore = ReturnType<typeof useStoreApi>;

function Harness({
  domNode,
  onStore,
}: {
  domNode: HTMLDivElement;
  onStore: (store: FlowStore) => void;
}) {
  const store = useStoreApi();
  useLayoutEffect(() => {
    store.setState({ domNode });
    onStore(store);
  }, [domNode, onStore, store]);
  return <ViewportGestureSync />;
}

function setup() {
  const wrapper = document.createElement("div");
  let store: FlowStore | null = null;
  render(
    <ReactFlowProvider>
      <Harness domNode={wrapper} onStore={(s) => (store = s)} />
    </ReactFlowProvider>,
  );
  const start = () => store!.getState().onViewportChangeStart?.(VIEWPORT);
  const end = () => store!.getState().onViewportChangeEnd?.(VIEWPORT);
  return { wrapper, start, end };
}

/**
 * The panel blur is switched off by `data-viewport-moving` while the viewport
 * moves (`index.css`); the canvas at rest must never keep the attribute.
 */
describe("ViewportGestureSync", () => {
  afterEach(() => vi.useRealTimers());

  it("marks the wrapper while the viewport moves and clears it once it rests", () => {
    vi.useFakeTimers();
    const { wrapper, start, end } = setup();
    expect(wrapper.dataset.viewportMoving).toBeUndefined();

    start();
    expect(wrapper.dataset.viewportMoving).toBe("");

    end();
    vi.advanceTimersByTime(VIEWPORT_REST_MS - 1);
    expect(wrapper.dataset.viewportMoving).toBe("");
    vi.advanceTimersByTime(1);
    expect(wrapper.dataset.viewportMoving).toBeUndefined();
  });

  it("keeps the mark through a wheel pan's start and end per tick", () => {
    vi.useFakeTimers();
    const { wrapper, start, end } = setup();
    for (let tick = 0; tick < 10; tick++) {
      start();
      end();
      vi.advanceTimersByTime(16);
      expect(wrapper.dataset.viewportMoving).toBe("");
    }
    vi.advanceTimersByTime(VIEWPORT_REST_MS);
    expect(wrapper.dataset.viewportMoving).toBeUndefined();
  });
});
