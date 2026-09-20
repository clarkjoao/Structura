import type { NodeBuildContext } from "@/features/canvas/nodes/node-types/types";
import type { Component, Diagram, NodeLayout } from "@/features/diagram/model/diagram.types";

/**
 * A `NodeBuildContext` with nothing in it.
 *
 * Built field by field rather than cast, so adding a required field to the
 * context is a compile error here instead of an `undefined` surfacing inside a
 * descriptor at run time.
 */
export function emptyNodeBuildContext(overrides: Partial<NodeBuildContext> = {}): NodeBuildContext {
  const diagram: Diagram = {
    id: "d",
    name: "d",
    level: "container",
    createdAt: 0,
    updatedAt: 0,
    snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
    nodeLayouts: {},
    edgeLayouts: {},
    viewport: { x: 0, y: 0, zoom: 1 },
  };

  return {
    diagram,
    flows: [],
    endpointCallsByRoute: new Map(),
    resolvedComponents: {} as Record<string, Component>,
    resolvedNodeLayouts: {} as Record<string, NodeLayout>,
    sceneBadgeByComponentId: {},
    services: {},
    allDiagrams: {},
    selectedNodeId: null,
    selectedNodeIds: new Set<string>(),
    dragTargetPanelId: null,
    unparentCandidatePanelId: null,
    panelIds: new Set<string>(),
    connectionCounts: {},
    effectiveHandleOrder: {},
    childrenIndex: new Map(),
    isPlaying: false,
    isRecording: false,
    flowHighlight: {
      activeNodeId: null,
      activeConnId: null,
      visitedNodeIds: new Set<string>(),
      participantNodeIds: new Set<string>(),
      participantConnIds: new Set<string>(),
      openFrameConnIds: new Set<string>(),
    },
    activeStep: null,
    flowBadges: null,
    coverage: null,
    handleDrillDown: () => undefined,
    ...overrides,
  };
}
