import { describe, it, expect } from "vitest";
import { SEED_PL_DIAGRAMS } from "@/fixtures/seeds/pixledger";
import { D_CT_HUB } from "@/fixtures/seeds/pixledger/ids";
import type { Flow } from "../model/flow.types";
import { repairFlowsAfterRemovingDiagramElements } from "./flow-repair";
import { condition, makeFlow } from "@/test/flow-graph-helpers";
import { getOrderedStepIds, getStepCount } from "./flow-traversal";
import { checkFlowInvariants } from "./flow-graph";

/**
 * Deleting the "Auth Guard" component severs the seed flow: the step that
 * referenced it is dropped and the chain is pruned at that point instead of
 * being sewn back together, leaving the head alone and the tail as an
 * unreachable island.
 */
describe("deleting a component that a flow step references", () => {
  function seedFlow(): { flows: Record<string, Flow> } {
    const diagram = structuredClone(SEED_PL_DIAGRAMS[D_CT_HUB]!);
    return { flows: diagram.snapshot.flows };
  }

  it("starts from a five-step chain", () => {
    const { flows } = seedFlow();
    const flow = flows["flow-hub-internal-create"]!;

    expect(flow.entryStepId).toBe("hub-cp-f1");
    expect(getOrderedStepIds(flow)).toEqual([
      "hub-cp-f1",
      "hub-cp-f2",
      "hub-cp-f3",
      "hub-cp-f4",
      "hub-cp-f5",
    ]);
    expect(flow.steps["hub-cp-f2"]!.componentId).toBe("pl-hub-auth-guard");
    expect(checkFlowInvariants(flow)).toEqual([]);
  });

  it("keeps the chain continuous when the middle step's component is deleted", () => {
    const { flows } = seedFlow();

    repairFlowsAfterRemovingDiagramElements(flows, new Set(["pl-hub-auth-guard"]), new Set());

    const flow = flows["flow-hub-internal-create"]!;
    expect(flow.steps["hub-cp-f2"]).toBeUndefined();
    expect(flow.steps["hub-cp-f1"]!.next).toBe("hub-cp-f3");
    expect(getOrderedStepIds(flow)).toEqual(["hub-cp-f1", "hub-cp-f3", "hub-cp-f4", "hub-cp-f5"]);
    expect(getStepCount(flow)).toBe(4);
    expect(checkFlowInvariants(flow)).toEqual([]);
  });
});

describe("repairFlowsAfterRemovingDiagramElements", () => {
  it("reports the branch point it held back and leaves the flow intact", () => {
    const flow = makeFlow(
      [
        { id: "s1", type: "action", next: "s2" },
        { ...condition("s2", [["yes", "a0"]]), componentId: "doomed" },
        { id: "a0", type: "action" },
      ],
      "s1",
    );
    const flows = { [flow.id]: flow };
    const before = structuredClone(flow.steps);

    const held = repairFlowsAfterRemovingDiagramElements(flows, new Set(["doomed"]), new Set());

    expect(held).toEqual([
      {
        flowId: flow.id,
        flowName: flow.name,
        joins: [],
        blocked: [
          {
            code: "branch_point",
            stepId: "s2",
            branchTargetIds: ["a0"],
            detail: 'step "s2" is a branch point; removing it would orphan 1 branch(es)',
          },
        ],
      },
    ]);
    expect(flows[flow.id]!.steps).toEqual(before);
  });
});
