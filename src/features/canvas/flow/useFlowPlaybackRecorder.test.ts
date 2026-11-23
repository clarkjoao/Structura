import { describe, expect, it, vi } from "vitest";
import type { Flow, FlowStep } from "@/features/diagram";
import { planPlaybackPath } from "./useFlowPlaybackRecorder";

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
