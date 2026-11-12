import { afterEach, describe, expect, it, vi } from "vitest";
import {
  MINIMAP_DRAG_REFRESH_MS,
  createDragActivity,
  createDragThrottle,
} from "./miniMapDragThrottle";

/**
 * The minimap reads a mirror of React Flow's store. At rest the mirror must
 * follow every change (the minimap behaves as React Flow's own); during a drag
 * at most once per interval, and never lose the last frame of the gesture.
 */
describe("createDragThrottle", () => {
  afterEach(() => vi.useRealTimers());

  it("passes every change on at once while nothing is dragged", () => {
    const push = vi.fn();
    const throttle = createDragThrottle(push, createDragActivity());
    throttle.sourceChanged();
    throttle.sourceChanged();
    throttle.sourceChanged();
    expect(push).toHaveBeenCalledTimes(3);
  });

  it("pushes at most once per interval during a drag", () => {
    vi.useFakeTimers();
    const push = vi.fn();
    const activity = createDragActivity();
    const throttle = createDragThrottle(push, activity);
    activity.start();

    // One second of 120 Hz drag frames.
    for (let frame = 0; frame < 120; frame++) {
      throttle.sourceChanged();
      vi.advanceTimersByTime(1000 / 120);
    }
    expect(push.mock.calls.length).toBeLessThanOrEqual(Math.ceil(1000 / MINIMAP_DRAG_REFRESH_MS));
    expect(push.mock.calls.length).toBeGreaterThanOrEqual(
      Math.floor(1000 / MINIMAP_DRAG_REFRESH_MS) - 1,
    );
  });

  it("pushes what is still held the moment the drag ends", () => {
    vi.useFakeTimers();
    const push = vi.fn();
    const activity = createDragActivity();
    const throttle = createDragThrottle(push, activity);
    activity.start();
    throttle.sourceChanged();
    expect(push).not.toHaveBeenCalled();

    activity.stop();
    expect(push).toHaveBeenCalledTimes(1);
    // The interval timer was cancelled with it: nothing more arrives later.
    vi.advanceTimersByTime(MINIMAP_DRAG_REFRESH_MS * 2);
    expect(push).toHaveBeenCalledTimes(1);
  });

  it("does not push on drag end when nothing changed", () => {
    const push = vi.fn();
    const activity = createDragActivity();
    createDragThrottle(push, activity);
    activity.start();
    activity.stop();
    expect(push).not.toHaveBeenCalled();
  });

  it("stops listening once disposed", () => {
    vi.useFakeTimers();
    const push = vi.fn();
    const activity = createDragActivity();
    const throttle = createDragThrottle(push, activity);
    activity.start();
    throttle.sourceChanged();
    throttle.dispose();
    activity.stop();
    vi.advanceTimersByTime(MINIMAP_DRAG_REFRESH_MS * 2);
    expect(push).not.toHaveBeenCalled();
  });
});
