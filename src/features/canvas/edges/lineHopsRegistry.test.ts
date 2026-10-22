import { describe, expect, it, vi } from "vitest";
import { createLineHopsRegistry, NO_LINE_HOPS } from "./lineHopsRegistry";

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
