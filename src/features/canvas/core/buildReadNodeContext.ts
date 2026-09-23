import type { Component, Connection, Diagram, Flow } from "@/features/diagram/model";
import { EMPTY_READER_CATALOG, type ReaderCatalog } from "@/features/diagram/utils/reader-catalog";
import {
  buildChildrenIndex,
  endpointCallersByRoute,
  placedComponents,
} from "@/features/diagram/utils";
import type { NodeBuildContext } from "../nodes/node-types";
import {
  buildConnectionCountPerNode,
  buildEdgeHandleAssignments,
  buildEffectiveHandleOrder,
  buildPanelIds,
} from "../edges/connectionDerivations";
import { EMPTY_FLOW_HIGHLIGHT, type FlowBadges, type FlowHighlight } from "../flow/flowState";

/**
 * The script being read, as the canvas needs it.
 *
 * `null` while nothing is open — and then the canvas carries no numbers at
 * all, because the open script is what numbers it.
 */
export interface ReadDiagramReading {
  badges: FlowBadges | null;
  highlight: FlowHighlight;
}

const NOOP_DRILL_DOWN = (): void => {};

function readHandleState(
  connections: Connection[],
  components: Record<string, Component>,
): Pick<NodeBuildContext, "connectionCounts" | "effectiveHandleOrder"> {
  const connectionCounts = buildConnectionCountPerNode(connections);
  return {
    connectionCounts,
    effectiveHandleOrder: buildEffectiveHandleOrder(
      buildEdgeHandleAssignments(connections, connectionCounts, components),
      connections,
    ),
  };
}

function flowRefs(flows: Record<string, Flow>): { id: string; name: string }[] {
  return Object.values(flows).map((flow) => ({ id: flow.id, name: flow.name }));
}

function readIdleChrome(
  focusedNodeId: string | null,
): Pick<
  NodeBuildContext,
  | "versionBadgeByComponentId"
  | "selectedNodeId"
  | "selectedNodeIds"
  | "dragTargetPanelId"
  | "unparentCandidatePanelId"
> {
  return {
    versionBadgeByComponentId: {},
    selectedNodeId: focusedNodeId,
    selectedNodeIds: focusedNodeId ? new Set([focusedNodeId]) : new Set(),
    dragTargetPanelId: null,
    unparentCandidatePanelId: null,
  };
}

/**
 * Read-only descriptor context for a shared/embed diagram.
 *
 * Same `buildData` / `buildStyle` the editor runs, without edit callbacks.
 * Optional `focusedNodeId` marks a node as selected so CardNode can expand its
 * description on click (viewer has no RF selection).
 *
 * The names a card shows of its service and linked diagram come from `catalog`
 * — what the link carried, or what the reader's own store holds. A reader never
 * has the workspace itself, and without the names the same card draws shorter
 * and narrower than the editor's, off every waypoint laid out against it.
 *
 * @example
 * const ctx = buildReadNodeContext(diagram, components, layouts, connections, reading, play);
 * descriptor.buildData(component, ctx);
 */
export function buildReadNodeContext(
  diagram: Diagram,
  components: Record<string, Component>,
  layouts: NodeBuildContext["resolvedNodeLayouts"],
  connections: Connection[],
  reading: ReadDiagramReading | null,
  onPlayFlow: ((flowId: string) => void) | undefined,
  focusedNodeId: string | null = null,
  catalog: ReaderCatalog = EMPTY_READER_CATALOG,
): NodeBuildContext {
  const flows = diagram.snapshot.flows ?? {};
  return {
    diagram,
    flows: flowRefs(flows),
    endpointCallsByRoute: endpointCallersByRoute(Object.values(flows)),
    resolvedComponents: components,
    resolvedNodeLayouts: layouts,
    ...readIdleChrome(focusedNodeId),
    services: catalog.services,
    allDiagrams: catalog.diagrams,
    // From placed components only, as the editor builds it: a child of a panel
    // that has no layout is not nested inside a node that does not exist.
    panelIds: buildPanelIds(placedComponents(components, layouts)),
    ...readHandleState(connections, components),
    childrenIndex: buildChildrenIndex(components),
    isPlaying: Boolean(reading),
    isRecording: false,
    flowHighlight: reading?.highlight ?? EMPTY_FLOW_HIGHLIGHT,
    activeStep: null,
    flowBadges: reading?.badges ?? null,
    coverage: null,
    handleDrillDown: NOOP_DRILL_DOWN,
    onPlayFlow,
  };
}
