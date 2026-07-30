import type { Edge, Node } from "@xyflow/react";
import type { Diagram } from "@/features/diagram/model";
import { getCachedCanvasSnapshot } from "@/features/diagram/utils";

type ResolvedSnapshot = ReturnType<typeof getCachedCanvasSnapshot>;
import {
  isApiGroupComponent,
  isEndpointType,
  isPanelComponent,
} from "@/features/diagram/model";
import { buildChildrenIndex } from "@/features/diagram/utils";
import {
  OPACITY_FLOW_PLAYBACK_NODE_DIM,
  buildConnectionCountPerNode,
  buildEdgeHandleAssignments,
  buildEffectiveHandleOrder,
  buildPanelIds,
  buildEdge,
  filterVisibleConnections,
  EMPTY_FLOW_HIGHLIGHT,
  buildCollapsedPanelIds,
  computeNodeVisibility,
  resolveNodeDescriptor,
  type EdgeBuildParams,
  type NodeBuildContext,
} from "@/features/canvas";

/** When set, walkthrough canvas uses the same flow recording/playback visuals as the main canvas. */
export type WalkthroughEditorCanvasFlowVisuals = Pick<
  NodeBuildContext,
  "isPlaying" | "isRecording" | "flowHighlight" | "activeStep" | "recordingInfo"
> & {
  onRecordHandleClick?: NodeBuildContext["onRecordHandleClick"];
};

export function createWalkthroughEditorNodeBuildContext(
  diagram: Diagram,
  snapshot: ResolvedSnapshot,
  allDiagrams: Record<string, Diagram>,
  selectedComponentId: string | null,
  panelIds: Set<string>,
  connectionCounts: Record<string, { incoming: number; outgoing: number }>,
  effectiveHandleOrder: Record<string, { incoming: string[]; outgoing: string[] }>,
  flowVisuals: WalkthroughEditorCanvasFlowVisuals | null,
): NodeBuildContext {
  const selectedNodeIds = new Set(selectedComponentId ? [selectedComponentId] : []);
  return {
    diagram,
    flows: Object.values(diagram.snapshot.flows),
    resolvedComponents: snapshot.components,
    resolvedNodeLayouts: snapshot.nodeLayouts,
    sceneBadgeByComponentId: {},
    serviceCatalog: {},
    allDiagrams,
    selectedNodeId: selectedComponentId,
    selectedNodeIds,
    dragTargetPanelId: null,
    unparentCandidatePanelId: null,
    panelIds,
    connectionCounts,
    effectiveHandleOrder,
    isPlaying: flowVisuals?.isPlaying ?? false,
    isRecording: flowVisuals?.isRecording ?? false,
    flowHighlight: flowVisuals?.flowHighlight ?? EMPTY_FLOW_HIGHLIGHT,
    activeStep: flowVisuals?.activeStep ?? null,
    recordingInfo: flowVisuals?.recordingInfo ?? null,
    coverage: null,
    handleDrillDown: () => {},
    onRecordHandleClick: flowVisuals?.onRecordHandleClick,
    childrenIndex: buildChildrenIndex(snapshot.components),
  };
}

export function buildWalkthroughEditorNodes(
  diagram: Diagram,
  selectedComponentId: string | null,
  allDiagrams: Record<string, Diagram>,
  flowVisuals: WalkthroughEditorCanvasFlowVisuals | null = null,
): Node[] {
  const snapshot = getCachedCanvasSnapshot(diagram);
  const components = Object.values(snapshot.components);
  const visibleConnections = filterVisibleConnections(
    Object.values(snapshot.connections),
    snapshot.components,
  );
  const connectionCountPerNode = buildConnectionCountPerNode(visibleConnections);
  const edgeHandleAssignments = buildEdgeHandleAssignments(
    visibleConnections,
    connectionCountPerNode,
    snapshot.components,
  );
  const effectiveHandleOrder = buildEffectiveHandleOrder(edgeHandleAssignments, visibleConnections);
  const panelIds = buildPanelIds(components);
  const collapsedPanelIds = buildCollapsedPanelIds(snapshot.components);
  const highlightedNodeIds = new Set<string>();
  const selectedNodeIds = new Set(selectedComponentId ? [selectedComponentId] : []);

  const ctx = createWalkthroughEditorNodeBuildContext(
    diagram,
    snapshot,
    allDiagrams,
    selectedComponentId,
    panelIds,
    connectionCountPerNode,
    effectiveHandleOrder,
    flowVisuals,
  );

  const sorted = [...components].sort((left, right) => {
    const leftIsGroup = isPanelComponent(left) || isApiGroupComponent(left);
    const rightIsGroup = isPanelComponent(right) || isApiGroupComponent(right);
    if (leftIsGroup && !rightIsGroup) return -1;
    if (!leftIsGroup && rightIsGroup) return 1;
    if (leftIsGroup && rightIsGroup) {
      if (right.parentId === left.id) return -1;
      if (left.parentId === right.id) return 1;
    }
    return 0;
  });

  return sorted.map((component): Node => {
    const descriptor = resolveNodeDescriptor(component);
    const layout = snapshot.nodeLayouts[component.id];
    const vis = computeNodeVisibility(
      component,
      descriptor,
      layout,
      panelIds,
      selectedNodeIds,
      highlightedNodeIds,
      collapsedPanelIds,
      false,
      null,
      snapshot.components,
    );
    const style: Record<string, unknown> = {
      ...descriptor.buildStyle?.(component, ctx),
      ...(vis.dimmed ? { opacity: OPACITY_FLOW_PLAYBACK_NODE_DIM } : {}),
    };

    const lockedInGroup =
      isEndpointType(component.type) &&
      component.parentId != null &&
      isApiGroupComponent(snapshot.components[component.parentId]);

    return {
      id: component.id,
      type: descriptor.rfType,
      position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
      zIndex: vis.zIndex,
      connectable: false,
      selected: vis.isSelected,
      draggable: false,
      selectable: !(descriptor.selectable === false) && !lockedInGroup,
      focusable: descriptor.focusable ?? !lockedInGroup,
      ...(descriptor.dragHandle ? { dragHandle: descriptor.dragHandle } : {}),
      ...(vis.isChild ? { parentId: component.parentId!, extent: "parent" as const } : {}),
      hidden: vis.isHidden,
      style: style as Node["style"],
      data: descriptor.buildData(component, ctx),
    };
  });
}

const idleEdgeParams = (
  diagram: Diagram,
): Pick<
  EdgeBuildParams,
  | "diagram"
  | "selectedEdgeId"
  | "isPlaying"
  | "isRecording"
  | "activeStep"
  | "flowHighlight"
  | "recordingInfo"
  | "coverage"
> => ({
  diagram,
  selectedEdgeId: null,
  isPlaying: false,
  isRecording: false,
  activeStep: null,
  flowHighlight: EMPTY_FLOW_HIGHLIGHT,
  recordingInfo: null,
  coverage: null,
});

export function buildWalkthroughEditorEdges(
  diagram: Diagram,
  flowVisuals: WalkthroughEditorCanvasFlowVisuals | null = null,
): Edge[] {
  const snapshot = getCachedCanvasSnapshot(diagram);
  const visibleConnections = filterVisibleConnections(
    Object.values(snapshot.connections),
    snapshot.components,
  );
  const connectionCountPerNode = buildConnectionCountPerNode(visibleConnections);
  const edgeHandleAssignments = buildEdgeHandleAssignments(
    visibleConnections,
    connectionCountPerNode,
    snapshot.components,
  );
  const assignmentMap = new Map(edgeHandleAssignments.map((item) => [item.connId, item]));

  const useCustomEdges = flowVisuals !== null && (flowVisuals.isPlaying || flowVisuals.isRecording);

  const edgeParams: EdgeBuildParams = {
    ...idleEdgeParams(diagram),
    isPlaying: flowVisuals?.isPlaying ?? false,
    isRecording: flowVisuals?.isRecording ?? false,
    activeStep: flowVisuals?.activeStep ?? null,
    flowHighlight: flowVisuals?.flowHighlight ?? EMPTY_FLOW_HIGHLIGHT,
    recordingInfo: flowVisuals?.recordingInfo ?? null,
  };

  return visibleConnections.map((connection) => {
    const built = buildEdge(connection, assignmentMap.get(connection.id), edgeParams);
    if (!useCustomEdges) {
      return {
        id: built.id,
        source: built.source,
        target: built.target,
        sourceHandle: built.sourceHandle,
        targetHandle: built.targetHandle,
        type: "smoothstep" as const,
        label: connection.label,
        animated: false,
        style: built.style,
        markerEnd: built.markerEnd,
        markerStart: built.markerStart,
      };
    }
    return built as Edge;
  });
}
