import { describe, expect, it } from "vitest";
import type { Component, Connection } from "@/features/diagram";
import "@/features/elements/bootstrap";
import "@/features/canvas/nodes/node-types/registry";
import { buildConnectionCountPerNode, buildEdgeHandleAssignments } from "./connectionDerivations";

/**
 * Seen on the canvas: two edges into a Step Functions Fail, and the Choice's
 * second branch, were dropped — the slots came from the state type's spread
 * handles, but a Fail and a Choice are drawn by the flow node, which renders
 * one slot a side. The spec now comes from what the component renders.
 */
const state = (id: string, stateType?: string): Component =>
  ({
    id,
    name: id,
    description: "",
    parentId: null,
    type: "sfn-state",
    ...(stateType ? { stateType } : {}),
  }) as unknown as Component;

const link = (id: string, sourceId: string, targetId: string): Connection =>
  ({ id, sourceId, targetId, label: "" }) as Connection;

describe("slots come from the canvas a component is drawn with", () => {
  const components = {
    task: state("task"),
    other: state("other"),
    choice: state("choice", "Choice"),
    fail: state("fail", "Fail"),
  };
  const connections = [
    link("a", "task", "fail"),
    link("b", "other", "fail"),
    link("yes", "choice", "task"),
    link("no", "choice", "other"),
  ];
  const assigned = buildEdgeHandleAssignments(
    connections,
    buildConnectionCountPerNode(connections),
    components,
  );
  const byId = Object.fromEntries(assigned.map((entry) => [entry.connId, entry]));

  it("a flow-shaped state's edges all use its one slot a side", () => {
    expect(byId.a.targetHandle).toBe("target-0");
    expect(byId.b.targetHandle).toBe("target-0");
    expect(byId.yes.sourceHandle).toBe("source-0");
    expect(byId.no.sourceHandle).toBe("source-0");
  });

  it("a card-drawn state keeps spreading its slots", () => {
    const cards = [link("x", "task", "other"), link("y", "task", "fail")];
    const spread = buildEdgeHandleAssignments(
      cards,
      buildConnectionCountPerNode(cards),
      components,
    );
    expect(spread.map((entry) => entry.sourceHandle).sort()).toEqual(["source-0", "source-1"]);
  });
});
