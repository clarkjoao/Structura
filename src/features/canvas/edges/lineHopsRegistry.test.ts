import { afterEach, describe, expect, it, vi } from "vitest";
import { createDragActivity } from "../components/miniMapDragThrottle";
import {
  createLineHopsRegistry,
  LINE_HOPS_DRAG_REFRESH_MS,
  NO_LINE_HOPS,
} from "./lineHopsRegistry";

const p = (x: number, y: number) => ({ x, y });
const now = (run: () => void) => run();

describe("line hops registry", () => {
  it("computes hops from the paths edges publish", () => {
    const registry = createLineHopsRegistry(now);
    registry.publish("h", [p(0, 50), p(100, 50)]);
    registry.publish("v", [p(50, 0), p(50, 100)]);

    expect(registry.getHops("h")).toEqual([{ segIndex: 0, x: 50, y: 50 }]);
    expect(registry.getHops("v")).toBe(NO_LINE_HOPS);
  });

  it("notifies only the edges whose hops changed", () => {
    const registry = createLineHopsRegistry(now);
    registry.publish("h", [p(0, 50), p(100, 50)]);
    registry.publish("v", [p(50, 0), p(50, 100)]);
    registry.publish("far", [p(0, 500), p(100, 500)]);

    const onH = vi.fn();
    const onFar = vi.fn();
    registry.subscribe("h", onH);
    registry.subscribe("far", onFar);

    // The vertical moves along h: h's hop moves, `far` is untouched.
    registry.publish("v", [p(60, 0), p(60, 100)]);
    expect(onH).toHaveBeenCalledTimes(1);
    expect(onFar).not.toHaveBeenCalled();
  });

  it("keeps the same snapshot when a recompute changes nothing for an edge", () => {
    const registry = createLineHopsRegistry(now);
    registry.publish("h", [p(0, 50), p(100, 50)]);
    registry.publish("v", [p(50, 0), p(50, 100)]);
    const before = registry.getHops("h");

    registry.publish("other", [p(0, 500), p(100, 500)]);
    expect(registry.getHops("h")).toBe(before);
  });

  it("clears an edge's hops once what it crossed is removed", () => {
    const registry = createLineHopsRegistry(now);
    registry.publish("h", [p(0, 50), p(100, 50)]);
    registry.publish("v", [p(50, 0), p(50, 100)]);
    const onH = vi.fn();
    registry.subscribe("h", onH);

    registry.remove("v");
    expect(registry.getHops("h")).toBe(NO_LINE_HOPS);
    expect(onH).toHaveBeenCalledTimes(1);
  });

  it("recomputes once for a burst of publishes", () => {
    const queued: Array<() => void> = [];
    const registry = createLineHopsRegistry((run) => queued.push(run));
    registry.publish("a", [p(0, 50), p(100, 50)]);
    registry.publish("b", [p(50, 0), p(50, 100)]);
    registry.publish("c", [p(0, 70), p(100, 70)]);

    expect(queued).toHaveLength(1);
    queued[0]!();
    expect(registry.getHops("a")).toHaveLength(1);
    expect(registry.getHops("c")).toHaveLength(1);
  });
});

describe("line hops registry while nodes are dragged", () => {
  afterEach(() => vi.useRealTimers());

  /** A registry following a drag, recomputing synchronously once released. */
  function dragged() {
    vi.useFakeTimers();
    const activity = createDragActivity();
    const registry = createLineHopsRegistry(now);
    const stop = registry.followDrag(activity);
    registry.publish("h", [p(0, 50), p(100, 50)]);
    registry.publish("v", [p(50, 0), p(50, 100)]);
    return { activity, registry, stop };
  }

  it("recomputes at once at rest", () => {
    const { registry } = dragged();
    expect(registry.getHops("h")).toEqual([{ segIndex: 0, x: 50, y: 50 }]);
  });

  it("recomputes at most once per interval during a drag, not per frame", () => {
    const { activity, registry } = dragged();
    const onH = vi.fn();
    registry.subscribe("h", onH);
    activity.start();

    // Twelve frames at 120 Hz move the vertical along h: no recompute yet.
    for (let frame = 1; frame <= 12; frame += 1) {
      registry.publish("v", [p(50 + frame, 0), p(50 + frame, 100)]);
      vi.advanceTimersByTime(1000 / 120);
    }
    expect(onH).not.toHaveBeenCalled();
    expect(registry.getHops("h")).toEqual([{ segIndex: 0, x: 50, y: 50 }]);

    // The interval elapses: one recompute, with the latest path.
    vi.advanceTimersByTime(LINE_HOPS_DRAG_REFRESH_MS);
    expect(onH).toHaveBeenCalledTimes(1);
    expect(registry.getHops("h")).toEqual([{ segIndex: 0, x: 62, y: 50 }]);
  });

  it("recomputes the moment the drag ends, without waiting for the interval", () => {
    const { activity, registry } = dragged();
    activity.start();
    registry.publish("v", [p(70, 0), p(70, 100)]);
    expect(registry.getHops("h")).toEqual([{ segIndex: 0, x: 50, y: 50 }]);

    activity.stop();
    expect(registry.getHops("h")).toEqual([{ segIndex: 0, x: 70, y: 50 }]);
    // Nothing left on the timer to recompute again.
    expect(vi.getTimerCount()).toBe(0);
  });

  it("drops the hop of an edge the drag moved off the crossing at the drop", () => {
    const { activity, registry } = dragged();
    activity.start();
    registry.publish("v", [p(150, 0), p(150, 100)]);
    activity.stop();
    expect(registry.getHops("h")).toBe(NO_LINE_HOPS);
  });

  it("stops following the drag once released, and keeps a held change", () => {
    const { activity, registry, stop } = dragged();
    activity.start();
    registry.publish("v", [p(70, 0), p(70, 100)]);
    stop();
    expect(registry.getHops("h")).toEqual([{ segIndex: 0, x: 70, y: 50 }]);

    // No longer following: a drag in progress recomputes every change again.
    registry.publish("v", [p(80, 0), p(80, 100)]);
    expect(registry.getHops("h")).toEqual([{ segIndex: 0, x: 80, y: 50 }]);
  });
});
