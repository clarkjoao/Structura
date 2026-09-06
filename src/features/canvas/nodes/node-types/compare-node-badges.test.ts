import { describe, it, expect } from "vitest";
import { sceneBadgePropsForNode } from "./compare-node-badges";
import type { NodeBuildContext } from "./types";

function createMinimalNodeBuildContext(
  overrides: Partial<NodeBuildContext> = {},
): NodeBuildContext {
  return {
    diagram: {
      id: "d1",
      name: "Test",
      level: "container",
      createdAt: 0,
      updatedAt: 0,
      snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
      nodeLayouts: {},
      edgeLayouts: {},
      viewport: { x: 0, y: 0, zoom: 1 },
    },
    flows: [],
    resolvedComponents: {},
    resolvedNodeLayouts: {},
    sceneBadgeByComponentId: {},
    serviceCatalog: {},
    allDiagrams: {},
    selectedNodeId: null,
    selectedNodeIds: new Set(),
    dragTargetPanelId: null,
    unparentCandidatePanelId: null,
    panelIds: new Set(),
    connectionCounts: {},
    effectiveHandleOrder: {},
    isPlaying: false,
    isRecording: false,
    flowHighlight: {
      activeNodeId: null,
      activeConnId: null,
      visitedNodeIds: new Set(),
      participantNodeIds: new Set(),
      participantConnIds: new Set(),
      openFrameConnIds: new Set(),
    },
    activeStep: null,
    flowBadges: null,
    coverage: null,
    handleDrillDown: () => {},
    childrenIndex: new Map(),
    ...overrides,
  };
}

describe("sceneBadgePropsForNode", () => {
  const COMP_ID = "comp-1";

  it("returns {} when neither compareVisualByComponentId nor sceneBadgeByComponentId have the comp", () => {
    const ctx = createMinimalNodeBuildContext();
    const result = sceneBadgePropsForNode(ctx, COMP_ID);
    expect(result).toEqual({});
  });

  it("returns { sceneBadge } when sceneBadgeByComponentId contains the comp", () => {
    const badge = { name: "Scene A", color: "#ff0000" };
    const ctx = createMinimalNodeBuildContext({
      sceneBadgeByComponentId: { [COMP_ID]: badge },
    });
    const result = sceneBadgePropsForNode(ctx, COMP_ID);
    expect(result).toEqual({ sceneBadge: badge });
  });

  it("returns { sceneBadge: badgeA } when compareVisual has only badgeA", () => {
    const badgeA = { name: "Scene A", color: "#00ff00" };
    const ctx = createMinimalNodeBuildContext({
      compareVisualByComponentId: {
        [COMP_ID]: { opacity: 1, badgeA },
      },
    });
    const result = sceneBadgePropsForNode(ctx, COMP_ID);
    expect(result).toEqual({ sceneBadge: badgeA });
  });

  it("returns { compareBadges } when compareVisual has both badgeA and badgeB", () => {
    const badgeA = { name: "Scene A", color: "#00ff00" };
    const badgeB = { name: "Scene B", color: "#0000ff" };
    const ctx = createMinimalNodeBuildContext({
      compareVisualByComponentId: {
        [COMP_ID]: { opacity: 1, badgeA, badgeB },
      },
    });
    const result = sceneBadgePropsForNode(ctx, COMP_ID);
    expect(result).toEqual({ compareBadges: { a: badgeA, b: badgeB } });
  });
});
