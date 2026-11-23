import { describe, expect, it, vi } from "vitest";
import type { Flow, FlowStep } from "@/features/diagram";
import {
  particleDash,
  particleDashOffset,
  particleScale,
  planPlaybackPath,
} from "./useFlowPlaybackRecorder";

vi.mock("gif.js/dist/gif.worker.js?url", () => ({ default: "gif.worker.js" }));

function flow(steps: Record<string, Partial<FlowStep>>, entryStepId = "s1"): Flow {
  const built: Record<string, FlowStep> = {};
  for (const [id, step] of Object.entries(steps)) {
    built[id] = { id, type: "action", ...step } as FlowStep;
  }
  return { id: "f1", name: "Checkout", mermaid: "", diagramId: "d1", entryStepId, steps: built };
}

describe("planPlaybackPath", () => {
  it("follows next links from the entry step for a 3-step flow", () => {
    const path = planPlaybackPath(flow({ s1: { next: "s2" }, s2: { next: "s3" }, s3: {} }));
    expect(path.map((p) => p.stepId)).toEqual(["s1", "s2", "s3"]);
    expect(path.every((p) => p.advance.kind === "next")).toBe(true);
  });

  it("takes the first branch of a condition step", () => {
    const path = planPlaybackPath(
      flow({
        s1: { next: "c" },
        c: {
          type: "condition",
          branches: [
            { label: "yes", nextId: "s2" },
            { label: "no", nextId: "s3" },
          ],
        },
        s2: {},
        s3: {},
      } as Record<string, Partial<FlowStep>>),
    );
    expect(path.map((p) => p.stepId)).toEqual(["s1", "c", "s2"]);
    expect(path[1]!.advance).toEqual({ kind: "branch", index: 0 });
  });

  it("stops on a loop instead of recording forever", () => {
    const path = planPlaybackPath(flow({ s1: { next: "s2" }, s2: { next: "s1" } }));
    expect(path.map((p) => p.stepId)).toEqual(["s1", "s2"]);
  });

  it("is empty when the entry step is missing", () => {
    expect(planPlaybackPath(flow({ s1: {} }, "missing"))).toEqual([]);
  });
});

describe("particleDashOffset", () => {
  it("moves a request particle forward along the edge, like the flowParticle keyframes", () => {
    expect(particleDashOffset(0, false)).toBeCloseTo(0);
    expect(particleDashOffset(600, false)).toBeCloseTo(-56);
    expect(particleDashOffset(1200, false)).toBeCloseTo(0);
  });

  it("plays the keyframes backwards for a response", () => {
    expect(particleDashOffset(0, true)).toBeCloseTo(-112);
    expect(particleDashOffset(300, true)).toBeCloseTo(-84);
  });
});

describe("particleScale", () => {
  it("enlarges the particle when the recording is zoomed out", () => {
    expect(particleScale(0.5)).toBeCloseTo(3);
    expect(particleScale(0.25)).toBeCloseTo(6);
  });

  it("never draws it smaller than live", () => {
    expect(particleScale(2)).toBe(1);
  });

  it("grows the dash but keeps the live spacing, so edges keep their particle count", () => {
    expect(particleDash(1)).toEqual([6, 106]);
    const [dash, gap] = particleDash(3);
    expect(dash).toBeCloseTo(18);
    expect(dash + gap).toBeCloseTo(112);
  });

  it("caps the dash at half the cycle so particles never merge into a line", () => {
    expect(particleDash(50)).toEqual([56, 56]);
  });
});
