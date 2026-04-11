import { useMemo, useRef, type CSSProperties } from "react";
import type { Node } from "@xyflow/react";
import type {
  CompareElementVisual,
  Component,
  ComponentPatch,
  Diagram,
  Flow,
  NodeLayout,
  ServiceDefinition,
} from "@/features/diagram";
import {
  isPanelComponent,
  isApiGroupComponent,
  isEndpointType,
  isComponentAddedInActiveScene,
  isAncestorLocked,
  buildChildrenIndex,
} from "@/features/diagram";
import { resolveNodeDescriptor, type NodeBuildContext } from "./node-types";
import { useFlowMode } from "../flow/FlowModeContext";
import { buildCollapsedPanelIds, computeNodeVisibility } from "./nodeVisibility";
import type { FlowHighlight, RecordingInfo, CoverageInfo } from "../flow/flowState";
import { OPACITY_FLOW_PLAYBACK_NODE_DIM, OPACITY_TAG_FILTER_DIM } from "../canvas.constants";
import { getPendingNodeIds, useLLMStore } from "@/features/llm";

/** Scene identity for canvas node rebuilds — aligned with `useActiveDiagramSceneState`. */
export type DiagramSceneState = {
  id: string;
  activeSceneId: string | null;
  hasActiveScene: boolean;
};

interface UseCanvasNodesParams {
  diagram: Diagram | null | undefined;
  diagramSceneState: DiagramSceneState | null;
  flows: Flow[];
  resolvedComponents: Record<string, Component>;
  resolvedNodeLayouts: Record<string, NodeLayout>;
  sceneBadgeByComponentId: Record<string, { name: string; color: string }>;
  visibleComponents: Component[];
  panelIds: Set<string>;
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  highlightedNodeIds: Set<string>;
  serviceRegistry: Record<string, ServiceDefinition>;
  allDiagrams: Record<string, Diagram>;
  handleDrillDown: (id: string) => void;
  handlePanelCollapseToggle: (id: string) => void;
  isPlaying: boolean;
  dragTargetPanelId: string | null;
  unparentCandidatePanelId: string | null;
  connectionCountPerNode: Record<string, { incoming: number; outgoing: number }>;
  effectiveHandleOrder: Record<string, { incoming: string[]; outgoing: string[] }>;
  onReorderHandle?: (nodeId: string, side: "incoming" | "outgoing", connId: string, direction: "up" | "down") => void;
  flowHighlight: FlowHighlight;
  activeStep: import("@/features/diagram").FlowStep | null;
  recordingInfo: RecordingInfo | null;
  coverage: CoverageInfo | null;
  isViewingCoverage: boolean;
  activeFlowId?: string | null;
  onPlayFlow?: (flowId: string) => void;
  onAddEndpointToGroup?: (groupId: string) => void;
  isCompareMode?: boolean;
  compareVisualByComponentId?: Record<string, CompareElementVisual>;
  isNodeHiddenByTagFilter: (component: Component) => boolean;
  setNoteInlineEditingId?: (id: string | null) => void;
  setJsonViewerInlineEditingId?: (id: string | null) => void;
  updateComponent: (id: string, patch: ComponentPatch) => void;
}

/** Data-only canvas context — excludes callbacks and live `diagram` ref so memos do not invalidate on every Immer replace. */
type DataCtx = Omit<
  NodeBuildContext,
  | "diagram"
  | "isPlaying"
  | "isRecording"
  | "flowHighlight"
  | "activeStep"
  | "recordingInfo"
  | "coverage"
  | "handleDrillDown"
  | "onRecordHandleClick"
  | "onPanelCollapseToggle"
  | "onReorderHandle"
  | "onPlayFlow"
  | "onAddEndpointToGroup"
  | "setNoteInlineEditingId"
  | "setJsonViewerInlineEditingId"
  | "updateComponent"
> & {
  highlightedNodeIds: Set<string>;
  isViewingCoverage: boolean;
};

const EMPTY_JOURNEYS_BY_COMPONENT_ID: Record<string, { name: string }[]> =
  Object.freeze({});

/** Stable empty nodes list — avoids new `[]` on every “no diagram” render. */
const EMPTY_CANVAS_NODE_LIST: Node[] = [];

/**
 * Compare React Flow nodes produced by this hook (fields we set only).
 * Used to reuse previous node references when the memo re-runs without semantic changes.
 */
function isSameBuiltFlowNode(a: Node, b: Node): boolean {
  return (
    a.id === b.id &&
    a.type === b.type &&
    a.position === b.position &&
    a.zIndex === b.zIndex &&
    a.connectable === b.connectable &&
    a.selected === b.selected &&
    a.draggable === b.draggable &&
    a.selectable === b.selectable &&
    a.focusable === b.focusable &&
    a.className === b.className &&
    a.dragHandle === b.dragHandle &&
    a.parentId === b.parentId &&
    a.extent === b.extent &&
    a.hidden === b.hidden &&
    a.style === b.style &&
    a.data === b.data
  );
}

function compareDiffOutlineClass(
  visual: CompareElementVisual | undefined,
): string {
  if (!visual) return "";
  const hasA = visual.badgeA !== undefined;
  const hasB = visual.badgeB !== undefined;
  if (hasA && hasB) return "node-diff-modified";
  if (hasA && !hasB) return "node-diff-removed";
  if (!hasA && hasB) return "node-diff-added";
  return "";
}

/**
 * Fix C helpers — shallow equality that ignores function values.
 * buildData returns closures that are always new objects; treating all
 * function-valued keys as equal prevents needless data-reference churn.
 */
function shallowEqualIgnoringFunctions(
  a: Record<string, unknown> | undefined,
  b: Record<string, unknown> | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a);
  if (keysA.length !== Object.keys(b).length) return false;
  for (const key of keysA) {
    if (typeof a[key] === "function" && typeof b[key] === "function") continue;
    if (a[key] !== b[key]) return false;
  }
  return true;
}

function shallowEqualStyle(
  a: CSSProperties | undefined,
  b: CSSProperties | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  const keysA = Object.keys(a) as (keyof CSSProperties)[];
  if (keysA.length !== Object.keys(b).length) return false;
  for (const key of keysA) {
    if (a[key] !== b[key]) return false;
  }
  return true;
}

export function useCanvasNodes({
  diagram,
  diagramSceneState,
  flows,
  resolvedComponents,
  resolvedNodeLayouts,
  sceneBadgeByComponentId,
  visibleComponents,
  panelIds,
  selectedNodeId,
  selectedNodeIds,
  highlightedNodeIds,
  serviceRegistry,
  allDiagrams,
  handleDrillDown,
  handlePanelCollapseToggle,
  isPlaying,
  dragTargetPanelId,
  unparentCandidatePanelId,
  connectionCountPerNode,
  effectiveHandleOrder,
  onReorderHandle,
  flowHighlight,
  activeStep,
  recordingInfo,
  coverage,
  isViewingCoverage,
  activeFlowId,
  onPlayFlow,
  onAddEndpointToGroup,
  isCompareMode = false,
  compareVisualByComponentId,
  isNodeHiddenByTagFilter,
  setNoteInlineEditingId,
  setJsonViewerInlineEditingId,
  updateComponent,
}: UseCanvasNodesParams): Node[] {
  const diagramRef = useRef(diagram);
  diagramRef.current = diagram;
  const activeDiagramKey = diagram?.id ?? null;

  const { isRecording, onRecordHandleClick } = useFlowMode();
  const pendingPreviews = useLLMStore((state) => state.pendingPreviews);
  const pendingNodeIds = useMemo(
    () => getPendingNodeIds(pendingPreviews),
    [pendingPreviews],
  );

  const callbacksRef = useRef({
    handleDrillDown,
    onRecordHandleClick,
    onPanelCollapseToggle: handlePanelCollapseToggle,
    onReorderHandle,
    onPlayFlow,
    onAddEndpointToGroup,
    setNoteInlineEditingId,
    setJsonViewerInlineEditingId,
    updateComponent,
  });
  callbacksRef.current = {
    handleDrillDown,
    onRecordHandleClick,
    onPanelCollapseToggle: handlePanelCollapseToggle,
    onReorderHandle,
    onPlayFlow,
    onAddEndpointToGroup,
    setNoteInlineEditingId,
    setJsonViewerInlineEditingId,
    updateComponent,
  };

  /**
   * Fix C: Cache of stable data/style references per node id.
   * When buildData/buildStyle produce a semantically-equal result, we reuse
   * the previous reference so useLocalNodes can detect "no change" via ===.
   */
  const prevNodeDataRef = useRef<
    Map<string, {
      data: Record<string, unknown>;
      style: CSSProperties | undefined;
      position: { x: number; y: number };
    }>
  >(new Map());

  /** Reuse prior RF node objects when props match — avoids new array refs on redundant memo runs. */
  const prevRfNodesByIdRef = useRef<Map<string, Node>>(new Map());
  const prevNodesArrayRef = useRef<Node[]>(EMPTY_CANVAS_NODE_LIST);

  const dataCtx: DataCtx | null = useMemo(() => {
    if (!diagram) return null;
    return {
      flows,
      resolvedComponents,
      resolvedNodeLayouts,
      sceneBadgeByComponentId,
      compareVisualByComponentId,
      isCompareMode,
      serviceRegistry: serviceRegistry ?? {},
      allDiagrams,
      selectedNodeId,
      selectedNodeIds,
      dragTargetPanelId,
      unparentCandidatePanelId,
      panelIds,
      connectionCounts: connectionCountPerNode,
      effectiveHandleOrder,
      activeFlowId,
      highlightedNodeIds,
      isViewingCoverage,
      journeysByComponentId: EMPTY_JOURNEYS_BY_COMPONENT_ID,
      childrenIndex: buildChildrenIndex(resolvedComponents),
    };
  }, [
    activeDiagramKey,
    resolvedComponents,
    resolvedNodeLayouts,
    sceneBadgeByComponentId,
    compareVisualByComponentId,
    isCompareMode,
    serviceRegistry,
    allDiagrams,
    selectedNodeId,
    selectedNodeIds,
    dragTargetPanelId,
    unparentCandidatePanelId,
    panelIds,
    connectionCountPerNode,
    effectiveHandleOrder,
    activeFlowId,
    highlightedNodeIds,
    isViewingCoverage,
    flows,
  ]);

  const nodeCtxPlayback = useMemo(
    () => ({
      isPlaying,
      isRecording,
      flowHighlight,
      activeStep,
      recordingInfo,
      coverage,
    }),
    [isPlaying, isRecording, flowHighlight, activeStep, recordingInfo, coverage],
  );

  return useMemo(() => {
    const diagram = diagramRef.current;
    if (!dataCtx || !diagram) {
      prevRfNodesByIdRef.current.clear();
      prevNodesArrayRef.current = EMPTY_CANVAS_NODE_LIST;
      return EMPTY_CANVAS_NODE_LIST;
    }

    const sceneActive = diagramSceneState?.hasActiveScene ?? false;

    const {
      highlightedNodeIds: hIds,
      isViewingCoverage: viewingCov,
      ...restForCtx
    } = dataCtx;

    const ctx: NodeBuildContext = {
      diagram,
      ...restForCtx,
      ...callbacksRef.current,
      ...nodeCtxPlayback,
    };

    const collapsedPanelIds = buildCollapsedPanelIds(dataCtx.resolvedComponents);

    const lockedNodeIds = new Set<string>();
    for (const comp of Object.values(dataCtx.resolvedComponents)) {
      if (comp.locked === true || isAncestorLocked(comp, dataCtx.resolvedComponents)) {
        lockedNodeIds.add(comp.id);
      }
    }

    const compareVisual = dataCtx.compareVisualByComponentId;
    const isCmp = dataCtx.isCompareMode ?? false;

    // Fix C: purge stale cache entries for nodes no longer visible
    const visibleIds = new Set(visibleComponents.map((c) => c.id));
    for (const cachedId of prevNodeDataRef.current.keys()) {
      if (!visibleIds.has(cachedId)) prevNodeDataRef.current.delete(cachedId);
    }
    for (const cachedId of prevRfNodesByIdRef.current.keys()) {
      if (!visibleIds.has(cachedId)) prevRfNodesByIdRef.current.delete(cachedId);
    }

    function getParentDepth(
      comp: Component,
      comps: Record<string, Component>,
    ): number {
      let depth = 0;
      let currentId = comp.parentId;
      const visited = new Set<string>();
      while (currentId && comps[currentId] && !visited.has(currentId)) {
        visited.add(currentId);
        depth++;
        currentId = comps[currentId].parentId;
      }
      return depth;
    }

    const depthCache = new Map<string, number>();
    function getDepth(comp: Component): number {
      if (depthCache.has(comp.id)) return depthCache.get(comp.id)!;
      const d = getParentDepth(comp, dataCtx.resolvedComponents);
      depthCache.set(comp.id, d);
      return d;
    }

    const nextNodes = [...visibleComponents]
      .sort((a, b) => {
        const aIsGroup = isPanelComponent(a) || isApiGroupComponent(a);
        const bIsGroup = isPanelComponent(b) || isApiGroupComponent(b);
        if (aIsGroup && !bIsGroup) return -1;
        if (!aIsGroup && bIsGroup) return 1;
        const depthA = getDepth(a);
        const depthB = getDepth(b);
        if (depthA !== depthB) return depthA - depthB;
        return 0;
      })
      .map((comp): Node => {
        const d = resolveNodeDescriptor(comp);
        const layout = dataCtx.resolvedNodeLayouts[comp.id];
        const vis = computeNodeVisibility(
          comp,
          d,
          layout,
          dataCtx.panelIds,
          dataCtx.selectedNodeIds,
          hIds,
          collapsedPanelIds,
          viewingCov,
          nodeCtxPlayback.coverage,
          dataCtx.resolvedComponents,
        );
        const style: Record<string, unknown> = {
          ...d.buildStyle?.(comp, ctx),
          ...(vis.dimmed ? { opacity: OPACITY_FLOW_PLAYBACK_NODE_DIM } : {}),
        };
        const cmpVis = compareVisual?.[comp.id];
        if (cmpVis !== undefined) {
          const baseOp = typeof style.opacity === "number" ? style.opacity : 1;
          style.opacity = baseOp * cmpVis.opacity;
        }
        const tagFilteredHidden = isNodeHiddenByTagFilter(comp);
        if (tagFilteredHidden) {
          style.opacity = OPACITY_TAG_FILTER_DIM;
          style.pointerEvents = "none";
          style.transition = "opacity 0.2s ease";
        }
        const lockedInGroup =
          isEndpointType(comp.type) &&
          comp.parentId != null &&
          isApiGroupComponent(dataCtx.resolvedComponents[comp.parentId]);
        const sceneLocksBase =
          sceneActive && !isComponentAddedInActiveScene(diagram, comp.id);
        const isLockedBySelfOrAncestor = lockedNodeIds.has(comp.id);
        const diffOutline =
          isCmp && cmpVis !== undefined ? compareDiffOutlineClass(cmpVis) : "";
        const nodeClassNames = [
          isCmp ? "cursor-default" : "",
          isLockedBySelfOrAncestor ? "cursor-not-allowed" : "",
          pendingNodeIds.has(comp.id) ? "node-pending" : "",
          diffOutline,
        ]
          .filter(Boolean)
          .join(" ");
        // Fix C: stabilize data/style/position references using shallow equality so
        // that useLocalNodes can detect "no change" via reference equality (===).
        const newData = d.buildData(comp, ctx) as Record<string, unknown>;
        const newStyle = style as CSSProperties;
        const newPosX = layout?.x ?? 0;
        const newPosY = layout?.y ?? 0;
        const cached = prevNodeDataRef.current.get(comp.id);
        const stableData =
          cached && shallowEqualIgnoringFunctions(cached.data, newData)
            ? cached.data
            : newData;
        const stableStyle =
          cached && shallowEqualStyle(cached.style, newStyle)
            ? cached.style
            : newStyle;
        const stablePosition =
          cached &&
          cached.position.x === newPosX &&
          cached.position.y === newPosY
            ? cached.position
            : { x: newPosX, y: newPosY };
        prevNodeDataRef.current.set(comp.id, {
          data: stableData,
          style: stableStyle,
          position: stablePosition,
        });

        const built: Node = {
          id: comp.id,
          type: d.rfType,
          position: stablePosition,
          zIndex: vis.zIndex,
          connectable: d.connectable && !isCmp && !tagFilteredHidden,
          selected: vis.isSelected,
          draggable:
            !isLockedBySelfOrAncestor &&
            (d.draggable ?? !lockedInGroup) &&
            !sceneLocksBase &&
            !isCmp &&
            !tagFilteredHidden,
          selectable:
            !isLockedBySelfOrAncestor &&
            (d.selectable ?? !lockedInGroup) &&
            !isCmp &&
            !tagFilteredHidden,
          focusable: (d.focusable ?? !lockedInGroup) && !isCmp && !tagFilteredHidden,
          className: nodeClassNames || undefined,
          ...(d.dragHandle ? { dragHandle: d.dragHandle } : {}),
          ...(vis.isChild ? { parentId: comp.parentId!, extent: "parent" as const } : {}),
          hidden: vis.isHidden,
          style: stableStyle,
          data: stableData,
        };

        const prevRf = prevRfNodesByIdRef.current.get(comp.id);
        const nodeToUse =
          prevRf && isSameBuiltFlowNode(prevRf, built) ? prevRf : built;
        if (nodeToUse === built) {
          prevRfNodesByIdRef.current.set(comp.id, built);
        }
        return nodeToUse;
      });

    const prevArr = prevNodesArrayRef.current;
    if (
      nextNodes.length === prevArr.length &&
      nextNodes.length > 0 &&
      nextNodes.every((node, index) => node === prevArr[index])
    ) {
      return prevArr;
    }
    if (nextNodes.length === 0) {
      prevNodesArrayRef.current = EMPTY_CANVAS_NODE_LIST;
      return EMPTY_CANVAS_NODE_LIST;
    }
    prevNodesArrayRef.current = nextNodes;
    return nextNodes;
  }, [
    diagramSceneState,
    dataCtx,
    nodeCtxPlayback,
    visibleComponents,
    isNodeHiddenByTagFilter,
    pendingNodeIds,
  ]);
}
