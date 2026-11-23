import { describe, expect, it } from "vitest";
import type { Component } from "@/features/diagram";
import { emptyNodeBuildContext } from "../node-build-context.fixture";
import { processNodeElement } from "./process-node.element";

const step = (id: string) =>
  ({ id, type: "process-node", name: id, parentId: null, flowShape: "rectangle" }) as Component;

describe("process-node while a flow is read", () => {
  const reading = (activeNodeId: string) => {
    const base = emptyNodeBuildContext();
    return emptyNodeBuildContext({
      isPlaying: true,
      selectedNodeId: "b",
      flowHighlight: {
        ...base.flowHighlight,
        activeNodeId,
        participantNodeIds: new Set(["a", "b"]),
      },
    });
  };
  const { buildData, buildStyle } = processNodeElement.canvas;

  it("rings the step being read, not the selection", () => {
    const ctx = reading("a");
    expect(buildData!(step("a"), ctx).isSelected).toBe(true);
    expect(buildData!(step("b"), ctx).isSelected).toBe(false);
  });

  it("dims what the step being read is not", () => {
    const ctx = reading("a");
    const active = buildStyle!(step("a"), ctx)?.opacity;
    const other = buildStyle!(step("b"), ctx)?.opacity;
    expect(active).toBe(1);
    expect(other).toBeLessThan(1);
  });

  it("is unchanged when no flow is read", () => {
    const ctx = emptyNodeBuildContext({ selectedNodeId: "a" });
    expect(buildData!(step("a"), ctx).isSelected).toBe(true);
    expect(buildStyle!(step("a"), ctx)?.opacity).toBeUndefined();
  });
});
