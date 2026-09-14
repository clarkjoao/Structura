import type { Component, Connection, Diagram, Flow } from "@/features/diagram/model";
import { buildChildrenIndex, endpointCallersByRoute } from "@/features/diagram/utils";
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

function readIdleChrome(): Pick<
  NodeBuildContext,
  | "sceneBadgeByComponentId"
  | "serviceCatalog"
  | "allDiagrams"
  | "selectedNodeId"
  | "selectedNodeIds"
  | "dragTargetPanelId"
  | "unparentCandidatePanelId"
> {
  return {
    sceneBadgeByComponentId: {},
    serviceCatalog: {},
    allDiagrams: {},
    selectedNodeId: null,
    selectedNodeIds: new Set(),
    dragTargetPanelId: null,
    unparentCandidatePanelId: null,
  };
}

/**
 * Read-only descriptor context for a shared/embed diagram.
 *
 * Same `buildData` / `buildStyle` the editor runs, without selection, catalog,
 * or edit callbacks. A missing `onPlayFlow` leaves route/group play inert.
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
): NodeBuildContext {
  const flows = diagram.snapshot.flows ?? {};
  return {
    diagram,
    flows: flowRefs(flows),
    endpointCallsByRoute: endpointCallersByRoute(Object.values(flows)),
    resolvedComponents: components,
    resolvedNodeLayouts: layouts,
    ...readIdleChrome(),
    panelIds: buildPanelIds(Object.values(components)),
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
