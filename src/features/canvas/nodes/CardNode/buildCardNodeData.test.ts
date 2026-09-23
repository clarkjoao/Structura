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

function ctxWithLayout(
  height: number | undefined,
  overrides: Partial<NodeBuildContext> = {},
): NodeBuildContext {
  return {
    ...ctxWithCounts(1, 1),
    resolvedNodeLayouts: { c1: { elementId: "c1", x: 0, y: 0, width: 260, height } },
    ...overrides,
  } as unknown as NodeBuildContext;
}

describe("buildCardNodeData reserves the height the layout assumed", () => {
  // The editor draws the service chip and the "explore inside" row; the reader
  // zeroes `services` / `allDiagrams`, so the same card comes out ~70px shorter
  // and every handle-anchored waypoint misses. The box the layout measured has
  // to be the box both surfaces draw, and the handles sit inside it.
  it("floors the card at the laid-out height on a reader", () => {
    const data = buildCardNodeData(container, ctxWithLayout(174, { isReader: true }));
    expect(data.laidOutMinHeight).toBe(174);
  });

  it("floors the card in the editor while a flow plays, which hides its content", () => {
    const data = buildCardNodeData(container, ctxWithLayout(174, { isPlaying: true }));
    expect(data.laidOutMinHeight).toBe(174);
  });

  // The editor writes what it measures back into the layout. A floor there is
  // fed by its own measurement: a card that grew while selected (a long
  // description) came back at the grown height and could never shrink.
  it("does not floor the card in the editor otherwise", () => {
    expect(buildCardNodeData(container, ctxWithLayout(174)).laidOutMinHeight).toBeUndefined();
  });

  it("leaves a card the layout never sized to its content", () => {
    const data = buildCardNodeData(container, ctxWithLayout(undefined, { isReader: true }));
    expect(data.laidOutMinHeight).toBeUndefined();
  });

  it("does not floor the card while a compare diff is shown", () => {
    const data = buildCardNodeData(
      container,
      ctxWithLayout(174, { isReader: true, isCompareMode: true }),
    );
    expect(data.laidOutMinHeight).toBeUndefined();
  });
});
