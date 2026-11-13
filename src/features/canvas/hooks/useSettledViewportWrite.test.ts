import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { useSettledViewportWrite, VIEWPORT_SETTLE_MS } from "./useSettledViewportWrite";

/**
 * A wheel pan reports one move-end per animation frame. Writing each one to the
 * store serialised the whole workspace 60 times a second; the hook turns a
 * gesture into one write, and flushes it before anything could read it stale.
 */
const vp = (i: number) => ({ x: i, y: -i, zoom: 0.3 });

describe("useSettledViewportWrite", () => {
  let firstId: string;
  let secondId: string;

  beforeEach(() => {
    vi.useFakeTimers();
    const state = useDiagramStore.getState();
    firstId = state.addDiagram("First", "container").id;
    secondId = useDiagramStore.getState().addDiagram("Second", "container").id;
    useDiagramStore.getState().openDiagram(firstId);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  function setup() {
    const write = vi.fn();
    const hook = renderHook(() => useSettledViewportWrite(write));
    return { write, hook, schedule: hook.result.current };
  }

  it("writes once, with the last viewport, after the gesture settles", () => {
    const { write, schedule } = setup();
    for (let i = 0; i < 60; i += 1) {
      schedule(vp(i));
      vi.advanceTimersByTime(16);
    }
    expect(write).not.toHaveBeenCalled();

    vi.advanceTimersByTime(VIEWPORT_SETTLE_MS);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(vp(59), firstId);
  });

  it("flushes on the next pointer or key press", () => {
    const { write, schedule } = setup();
    schedule(vp(1));
    window.dispatchEvent(new Event("pointerdown"));
    expect(write).toHaveBeenCalledWith(vp(1), firstId);

    schedule(vp(2));
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "z" }));
    expect(write).toHaveBeenLastCalledWith(vp(2), firstId);
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("writes to the panned diagram when the user switches before it settles", () => {
    const { write, schedule } = setup();
    schedule(vp(3));
    act(() => {
      useDiagramStore.getState().openDiagram(secondId);
    });
    expect(write).toHaveBeenCalledTimes(1);
    expect(write).toHaveBeenCalledWith(vp(3), firstId);
  });

  it("flushes when the page is left or the canvas unmounts", () => {
    const { write, schedule, hook } = setup();
    schedule(vp(4));
    window.dispatchEvent(new Event("pagehide"));
    expect(write).toHaveBeenCalledWith(vp(4), firstId);

    schedule(vp(5));
    hook.unmount();
    expect(write).toHaveBeenLastCalledWith(vp(5), firstId);
    expect(write).toHaveBeenCalledTimes(2);
  });

  it("does nothing when there is nothing pending", () => {
    const { write, hook } = setup();
    window.dispatchEvent(new Event("pointerdown"));
    vi.advanceTimersByTime(VIEWPORT_SETTLE_MS * 2);
    hook.unmount();
    expect(write).not.toHaveBeenCalled();
  });
});
