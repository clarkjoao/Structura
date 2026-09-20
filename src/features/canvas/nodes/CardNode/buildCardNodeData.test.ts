import { describe, expect, it } from "vitest";
import { MAX_HANDLES } from "@/features/diagram/model/layout.constants";
import type { Component } from "@/features/diagram/model/component.types";
import type { NodeBuildContext } from "@/features/canvas/nodes/node-types/types";
import { buildCardNodeData } from "./buildCardNodeData";

function ctxWithCounts(incoming: number, outgoing: number): NodeBuildContext {
  return {
    isPlaying: false,
    isRecording: false,
    flowHighlight: {},
    activeStep: null,
    flowBadges: null,
    coverage: null,
    connectionCounts: { c1: { incoming, outgoing } },
    effectiveHandleOrder: {},
    versionBadgeByComponentId: {},
    selectedNodeId: null,
    selectedNodeIds: new Set(),
    allDiagrams: {},
    services: {},
  } as unknown as NodeBuildContext;
}

const container = {
  id: "c1",
  name: "Novo Container",
  type: "container",
  description: "",
  parentId: null,
} as Component;

describe("buildCardNodeData handle counts", () => {
  it("renders one visual slot per edge up to MAX_HANDLES (not a hard-coded 4)", () => {
    const data = buildCardNodeData(container, ctxWithCounts(1, 5));
    expect(data.outgoingCount).toBe(5);
  });

  it("still caps visual slots at MAX_HANDLES when the fan is denser", () => {
    const data = buildCardNodeData(container, ctxWithCounts(1, MAX_HANDLES + 3));
    expect(data.outgoingCount).toBe(MAX_HANDLES);
  });
});
