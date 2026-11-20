import { describe, expect, it } from "vitest";
import type { Flow, FlowStep } from "@/features/diagram";
import { neighbourSteps, planReadingFrame, READING_MIN_ZOOM } from "./readingFrame";

const PANE = { width: 1000, height: 800 };
const node = (x: number, y: number) => ({ x, y, width: 200, height: 80 });

describe("planReadingFrame", () => {
  it("frames the step with where it came from and where it goes", () => {
    const plan = planReadingFrame({
      step: node(400, 0),
      focus: node(400, 0),
      context: { x: 0, y: 0, width: 1000, height: 80 },
      viewport: { x: -5000, y: 0, zoom: 1 },
      pane: PANE,
    });
    expect(plan).toEqual({ kind: "fit", bounds: { x: 0, y: 0, width: 1000, height: 80 } });
  });

  it("frames the step alone when its neighbours would need zooming out too far", () => {
    const plan = planReadingFrame({
      step: node(0, 0),
      focus: node(0, 0),
      context: { x: 0, y: 0, width: 20_000, height: 80 },
      viewport: { x: -5000, y: 0, zoom: 1 },
      pane: PANE,
    });
    expect(plan).toEqual({ kind: "fit", bounds: node(0, 0) });
  });

  it("stays put when the step is already comfortably on screen", () => {
    const plan = planReadingFrame({
      step: node(100, 100),
      focus: node(100, 100),
      context: node(2000, 100),
      viewport: { x: 0, y: 0, zoom: 1 },
      pane: PANE,
    });
    expect(plan).toEqual({ kind: "stay" });
  });

  it("moves when the step is on screen but too small to read", () => {
    const plan = planReadingFrame({
      step: node(100, 100),
      focus: node(100, 100),
      context: null,
      viewport: { x: 0, y: 0, zoom: READING_MIN_ZOOM / 2 },
      pane: PANE,
    });
    expect(plan.kind).toBe("fit");
  });

  it("moves when the step sits against the pane's edge", () => {
    const plan = planReadingFrame({
      step: node(900, 100),
      focus: node(900, 100),
      context: null,
      viewport: { x: 0, y: 0, zoom: 1 },
      pane: PANE,
    });
    expect(plan.kind).toBe("fit");
  });
});

describe("a call too long to read at once", () => {
  it("frames the node the step lands on", () => {
    const plan = planReadingFrame({
      step: { x: 0, y: 0, width: 6000, height: 80 },
      focus: node(5800, 0),
      context: null,
      viewport: { x: 0, y: 0, zoom: 1 },
      pane: PANE,
    });
    expect(plan).toEqual({ kind: "fit", bounds: node(5800, 0) });
  });
});

describe("neighbourSteps", () => {
  const flow = (steps: FlowStep[]): Flow =>
    ({
      id: "f",
      name: "f",
      entryStepId: steps[0]!.id,
      steps: Object.fromEntries(steps.map((step) => [step.id, step])),
    }) as Flow;

  it("is the step before and the step after", () => {
    const f = flow([
      { id: "a", type: "action", next: "b" },
      { id: "b", type: "action", next: "c" },
      { id: "c", type: "action" },
    ]);
    expect(neighbourSteps(f, "b").map((step) => step.id)).toEqual(["a", "c"]);
  });

  it("counts a condition whose branch opens on the step as the step before", () => {
    const f = flow([
      { id: "c", type: "condition", branches: [{ label: "yes", nextId: "x" }] },
      { id: "x", type: "action" },
    ]);
    expect(neighbourSteps(f, "x").map((step) => step.id)).toEqual(["c"]);
  });
});
