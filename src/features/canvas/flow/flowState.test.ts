import { describe, expect, it } from "vitest";
import { condition, makeFlow } from "@/test/flow-graph-helpers";
import { buildFlowOutline } from "@/features/diagram";
import type { FlowStep } from "@/features/diagram";
import { buildFlowBadges } from "./flowState";

const flow = makeFlow([
  { id: "s1", type: "action", next: "c", componentId: "n1" },
  condition("c", [
    ["yes", "a1"],
    ["no", "b1"],
  ]),
  { id: "a1", type: "action", next: "join", connectionId: "e1", handleId: "right" },
  { id: "b1", type: "action", next: "join", componentId: "n2" },
  { id: "join", type: "action", componentId: "n1" },
] as FlowStep[]);

describe("buildFlowBadges", () => {
  it("puts the derived label on what each step points at", () => {
    const badges = buildFlowBadges(flow, buildFlowOutline(flow).rows);
    expect(badges.nodeLabels.get("n2")).toEqual(["2b"]);
    expect(badges.edgeLabels.get("e1")).toEqual(["2a"]);
  });

  it("keeps every visit to the same element, in reading order", () => {
    const badges = buildFlowBadges(flow, buildFlowOutline(flow).rows);
    expect(badges.nodeLabels.get("n1")).toEqual(["1", "3"]);
  });

  it("reports which elements the flow touches at all", () => {
    const badges = buildFlowBadges(flow, buildFlowOutline(flow).rows);
    expect([...badges.badgedNodeIds].sort()).toEqual(["n1", "n2"]);
    expect([...badges.badgedEdgeIds]).toEqual(["e1"]);
  });

  it("names the last row on screen, which is what the recorder pulses", () => {
    const outline = buildFlowOutline(flow);
    const chain = makeFlow([
      { id: "s1", type: "action", next: "s2", componentId: "first" },
      { id: "s2", type: "action", componentId: "last" },
    ] as FlowStep[]);
    expect(buildFlowBadges(chain, buildFlowOutline(chain).rows).lastNodeId).toBe("last");
    // Only the "yes" branch on screen: its last row is the edge step.
    const branchRows = outline.rows.filter((row) => row.label.startsWith("2a"));
    const branchBadges = buildFlowBadges(flow, branchRows);
    expect(branchBadges.lastEdgeId).toBe("e1");
    expect(branchBadges.lastHandleId).toBe("right");
  });

  it("badges nothing when no row is on screen", () => {
    const badges = buildFlowBadges(flow, []);
    expect(badges.nodeLabels.size).toBe(0);
    expect(badges.lastNodeId).toBeNull();
  });

  it("skips a row whose step is gone", () => {
    const badges = buildFlowBadges(flow, [
      { stepId: "ghost", label: "9", depth: 0, isBranchPoint: false, isBranchHead: false },
    ]);
    expect(badges.nodeLabels.size).toBe(0);
    expect(badges.badgedNodeIds.size).toBe(0);
    expect(badges.lastNodeId).toBeNull();
  });
});
