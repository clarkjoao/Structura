import { describe, expect, it } from "vitest";
import { kindLayoutGaps } from "@/features/canvas/layout/kindLayoutServices";
import { arrangeGuidedSync } from "./guided.arrange";
import { guidedHarness } from "./guided.harness";
import { guidedAddLane } from "./guided.edits";

type Harness = ReturnType<typeof guidedHarness>;

/** Start (lane 1) → A (lane 2) → B (lane 3). */
function threeLanes(direction?: "TB") {
  const h = guidedHarness(direction);
  h.apply(guidedAddLane(h.diagram(), "API"));
  const lanes = h.reading().lanes.map((l) => l.id);
  const a = h.run("guided.next", [h.startId])!;
  h.run("guided.laneDown", [a]);
  const b = h.run("guided.next", [a])!;
  h.run("guided.laneDown", [b]);
  return { h, lanes, a, b };
}

function inside(h: Harness, stepId: string, laneId: string): boolean {
  const step = h.absolute(stepId);
  const lane = h.absolute(laneId);
  return (
    step.x >= lane.x &&
    step.y >= lane.y &&
    step.x + step.width <= lane.x + lane.width &&
    step.y + step.height <= lane.y + lane.height
  );
}

const overlap = (a: ReturnType<Harness["absolute"]>, b: ReturnType<Harness["absolute"]>) =>
  a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe("lane-banded arrangement", () => {
  it("left to right: consecutive columns, each step in its lane's band, bands in lane order", () => {
    const { h, lanes, a, b } = threeLanes();
    const xs = [h.startId, a, b].map((id) => h.absolute(id).x);
    expect(xs[0]!).toBeLessThan(xs[1]!);
    expect(xs[1]!).toBeLessThan(xs[2]!);
    expect(h.reading().laneOf.get(a)).toBe(lanes[1]);
    expect(inside(h, h.startId, lanes[0]!)).toBe(true);
    expect(inside(h, a, lanes[1]!)).toBe(true);
    expect(inside(h, b, lanes[2]!)).toBe(true);
    const ys = lanes.map((id) => h.absolute(id).y);
    expect(ys[0]!).toBeLessThan(ys[1]!);
    expect(ys[1]!).toBeLessThan(ys[2]!);
    // Bands touch: each starts where the previous ends.
    expect(h.absolute(lanes[1]!).y).toBe(h.absolute(lanes[0]!).y + h.absolute(lanes[0]!).height);
  });

  it("top to bottom: the same arrangement mirrored", () => {
    const { h, lanes, a, b } = threeLanes("TB");
    const ys = [h.startId, a, b].map((id) => h.absolute(id).y);
    expect(ys[0]!).toBeLessThan(ys[1]!);
    expect(ys[1]!).toBeLessThan(ys[2]!);
    const xs = lanes.map((id) => h.absolute(id).x);
    expect(xs[0]!).toBeLessThan(xs[1]!);
    expect(xs[1]!).toBeLessThan(xs[2]!);
    expect(inside(h, b, lanes[2]!)).toBe(true);
  });

  it("stacks two exits in one lane in the next column without overlap, growing the band", () => {
    const h = guidedHarness();
    const step = h.run("guided.next", [h.startId])!;
    const branch = h.run("guided.branch", [step])!;
    const decision = h.reading().incoming.get(branch)![0]!.sourceId;
    const other = h.run("guided.next", [decision])!;
    const [x, y] = [h.absolute(branch), h.absolute(other)];
    expect(Math.abs(x.x + x.width / 2 - (y.x + y.width / 2))).toBeLessThan(1);
    expect(overlap(x, y)).toBe(false);
    expect(inside(h, branch, h.laneIds[0]!)).toBe(true);
    expect(inside(h, other, h.laneIds[0]!)).toBe(true);
  });

  it("spaces columns wider when spacious", () => {
    const { h } = threeLanes();
    const normal = arrangeGuidedSync(h.diagram(), {
      measured: {},
      gaps: kindLayoutGaps(undefined),
    });
    const spacious = arrangeGuidedSync(h.diagram(), {
      measured: {},
      gaps: kindLayoutGaps({ density: "spacious" }),
    });
    const lane = h.reading().lanes[0]!.id;
    const width = (r: typeof normal) => r.layouts.find((l) => l.elementId === lane)!.width!;
    expect(width(spacious)).toBeGreaterThan(width(normal));
  });

  it("does not let a retry back-edge push the steps it returns to", () => {
    const h = guidedHarness();
    const a = h.run("guided.next", [h.startId])!;
    const b = h.run("guided.next", [a])!;
    const before = h.absolute(a);
    h.apply({ connect: [{ source: b, target: a, label: "retry" }] });
    expect(h.absolute(a)).toEqual(before);
  });
});

describe("stability", () => {
  function chain(n: number) {
    const h = guidedHarness();
    const ids = [h.startId];
    for (let i = 0; i < n; i++) ids.push(h.run("guided.next", [ids[ids.length - 1]!])!);
    return { h, ids };
  }

  it("an append moves no existing step", () => {
    const { h, ids } = chain(5);
    const before = ids.map((id) => h.absolute(id));
    h.run("guided.next", [ids[ids.length - 1]!]);
    expect(ids.map((id) => h.absolute(id))).toEqual(before);
  });

  it("an insert moves only the steps after it", () => {
    const { h, ids } = chain(5);
    const before = ids.map((id) => h.absolute(id));
    h.run("guided.next", [ids[2]!]);
    const after = ids.map((id) => h.absolute(id));
    expect(after.slice(0, 3)).toEqual(before.slice(0, 3));
    for (let i = 3; i < ids.length; i++) expect(after[i]!.x).toBeGreaterThan(before[i]!.x);
  });
});

describe("arrangement time", () => {
  /** Measured, not asserted against a machine: the budget is checked at 100 steps. */
  it.each([100, 300])("arranges %i steps", (n) => {
    const h = guidedHarness();
    const add: Parameters<Harness["apply"]>[0]["add"] = [];
    const connect: NonNullable<Parameters<Harness["apply"]>[0]["connect"]> = [];
    let previous = h.startId;
    for (let i = 0; i < n; i++) {
      add!.push({
        key: `s${i}`,
        type: "process-node",
        flowShape: "rectangle",
        name: `S${i}`,
        parent: h.laneIds[i % 2]!,
        x: 0,
        y: 0,
      });
      connect.push({ source: previous, target: `s${i}` });
      previous = `s${i}`;
    }
    h.store.getState().applyKindEdit({ add, connect }, { history: false });
    const runs = 5;
    const started = performance.now();
    for (let i = 0; i < runs; i++) {
      arrangeGuidedSync(h.diagram(), { measured: {}, gaps: { layer: 96, node: 32 } });
    }
    const ms = (performance.now() - started) / runs;
    console.info(`[guided layout] ${n} steps: ${ms.toFixed(1)} ms`);
    if (n === 100) expect(ms).toBeLessThan(50);
  });
});
