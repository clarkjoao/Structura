import { describe, expect, it } from "vitest";
import { SEED_US_DIAGRAMS } from "@/fixtures/seeds/urlshort-example";
import type { Flow } from "../model/flow.types";
import { buildFlowOutline } from "./flow-outline";
import { buildCallStack } from "./flow-call-stack";

/**
 * The reading has to have something to read on a fresh install.
 *
 * A response that names no connection closes nothing, so the seed's own script
 * derived a flat stack and the feature looked broken to anyone who had just
 * opened the product. This is the evidence that it no longer does — and the
 * guard against the connection being dropped from that step again.
 */

function seedFlows(): Flow[] {
  return Object.values(SEED_US_DIAGRAMS).flatMap((diagram) =>
    Object.values(diagram.snapshot.flows ?? {}),
  );
}

describe("the seeded scripts pair their calls", () => {
  it("has at least one script that opens and closes a call", () => {
    const paired = seedFlows().filter((flow) => {
      const stack = buildCallStack(flow, buildFlowOutline(flow));
      return [...stack.byStep.values()].some((info) => info.closesFrameId !== null);
    });

    expect(paired.length).toBeGreaterThan(0);
  });

  it("reads the context script as a call with work inside it", () => {
    const flow = seedFlows().find((candidate) => candidate.steps["ctx-f1"]);
    expect(flow).toBeDefined();

    const stack = buildCallStack(flow!, buildFlowOutline(flow!));

    expect(stack.byStep.get("ctx-f1")!.opensFrameId).toBe("ctx-f1");
    expect(stack.byStep.get("ctx-f2")!.callDepth).toBe(1);
    expect(stack.byStep.get("ctx-f3")!.closesFrameId).toBe("ctx-f1");
    expect(stack.byStep.get("ctx-f3")!.callDepth).toBe(0);
  });

  it("leaves no seeded response answering a call nobody made", () => {
    for (const flow of seedFlows()) {
      const stack = buildCallStack(flow, buildFlowOutline(flow));
      expect({ flow: flow.name, orphans: stack.orphanResponses }).toEqual({
        flow: flow.name,
        orphans: [],
      });
    }
  });
});
