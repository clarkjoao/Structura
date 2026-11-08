import { describe, expect, it } from "vitest";
import { AUTO_REF_TRIAL_BUDGET, autoRefTrialLimits } from "./autoRefs";
import type { LayoutGraph } from "./contract";

/**
 * Each reference trial is one more whole-graph layout. The trials a graph gets
 * are bounded by its size, so arranging a large diagram stays bounded, and by
 * nothing else, so the same diagram always gets the same references.
 */

const graphOf = (size: number): Pick<LayoutGraph, "nodes" | "edges"> => ({
  nodes: Array.from({ length: size }, (_, i) => ({
    id: `n${i}`,
    parentId: null,
    width: 100,
    height: 50,
  })),
  edges: [],
});

describe("autoRefTrialLimits", () => {
  it("keeps every trial for a small diagram", () => {
    expect(autoRefTrialLimits(graphOf(160))).toEqual({ hubTrials: 6, loneTrials: 12 });
  });

  it("gives the reference large diagram two hub trials and no lone one", () => {
    // `perf:large`: 657 nodes and 704 edges.
    expect(autoRefTrialLimits(graphOf(1361))).toEqual({ hubTrials: 2, loneTrials: 0 });
  });

  it("spends the budget on hubs first", () => {
    expect(autoRefTrialLimits(graphOf(Math.floor(AUTO_REF_TRIAL_BUDGET / 9)))).toEqual({
      hubTrials: 6,
      loneTrials: 3,
    });
  });

  it("runs no trial on a graph larger than the budget", () => {
    expect(autoRefTrialLimits(graphOf(AUTO_REF_TRIAL_BUDGET + 1))).toEqual({
      hubTrials: 0,
      loneTrials: 0,
    });
  });
});
