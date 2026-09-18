import { useMemo, useRef, type CSSProperties } from "react";
import type { Node } from "@xyflow/react";
import type {
  CompareElementVisual,
  Component,
  ComponentPatch,
  Diagram,
  DiagramModel,
  Flow,
  NodeLayout,
  ServiceDefinition,
} from "@/features/diagram";
import {
  endpointCallersByRoute,
  isComponentAddedInActiveScene,
  isAncestorLocked,
  buildChildrenIndex,
} from "@/features/diagram";
import { resolveNodeDescriptor, type NodeBuildContext } from "./node-types";
import { writePolicy } from "../core/canvasInteractionPolicy";
import { projectNodes } from "../core/projectDiagram";
import type { ViewSnapshot } from "../core/resolveViewSnapshot";
import { useFlowMode } from "../flow/FlowModeContext";
import { applyEditorNodeOverlays } from "./nodeOverlays";
import type { FlowHighlight, FlowBadges, CoverageInfo } from "../flow/flowState";
import { getPendingNodeIds, useLLMStore } from "@/features/llm";

/** The projection's policy on the editor path; interactivity is React Flow's, per canvas. */
const EDITOR_PROJECTION = writePolicy(true);
import { useStableSetByContent } from "../hooks/useStableSetByContent";

export type DiagramSceneState = {
  id: string;
  activeSceneId: string | null;
  hasActiveScene: boolean;
};

interface UseCanvasNodesParams {
  diagram: Diagram | DiagramModel | null | undefined;
  diagramSceneState: DiagramSceneState | null;
  flows: Flow[];
  resolvedComponents: Record<string, Component>;
  resolvedNodeLayouts: Record<string, NodeLayout>;
  sceneBadgeByComponentId: Record<string, { name: string; color: string }>;
  /** What is shown, in render order — `resolveViewSnapshot` for the diagram's own scenes. */
  view: ViewSnapshot;
  panelIds: Set<string>;
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  highlightedNodeIds: Set<string>;
  serviceCatalog: Record<string, ServiceDefinition>;
  allDiagrams: Record<string, Diagram>;
  handleDrillDown: (id: string) => void;
  handlePanelCollapseToggle: (id: string) => void;
  navigateToDiagram?: (diagramId: string, nodeId?: string) => void;
  isPlaying: boolean;
  dragTargetPanelId: string | null;
  unparentCandidatePanelId: string | null;
  connectionCountPerNode: Record<string, { incoming: number; outgoing: number }>;
  effectiveHandleOrder: Record<string, { incoming: string[]; outgoing: string[] }>;
  onReorderHandle?: (
    nodeId: string,
    side: "incoming" | "outgoing",
    connId: string,
    direction: "up" | "down",
  ) => void;
  flowHighlight: FlowHighlight;
  activeStep: import("@/features/diagram").FlowStep | null;
  flowBadges: FlowBadges | null;
  coverage: CoverageInfo | null;
  isViewingCoverage: boolean;
  onPlayFlow?: (flowId: string) => void;
  onAddEndpointToGroup?: (groupId: string) => void;
  isCompareMode?: boolean;
  compareVisualByComponentId?: Record<string, CompareElementVisual>;
  isNodeHiddenByTagFilter: (component: Component) => boolean;
  setNoteInlineEditingId?: (id: string | null) => void;
  setJsonViewerInlineEditingId?: (id: string | null) => void;
  updateComponent: (id: string, patch: ComponentPatch) => void;
}

type DataCtx = Omit<
  NodeBuildContext,
  | "diagram"
  | "isPlaying"
  | "isRecording"
  | "flowHighlight"
  | "activeStep"
  | "flowBadges"
  | "coverage"
  | "handleDrillDown"
  | "navigateToDiagram"
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
  /** Only id+name are needed — avoids full Flow[] as a useMemo dependency. */
  flows: { id: string; name: string }[];
};

const EMPTY_CANVAS_NODE_LIST: Node[] = [];

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

function shallowEqualStyle(a: CSSProperties | undefined, b: CSSProperties | undefined): boolean {
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
  view,
  panelIds,
  selectedNodeId,
  selectedNodeIds,
  highlightedNodeIds,
  serviceCatalog,
  allDiagrams,
  handleDrillDown,
  handlePanelCollapseToggle,
  navigateToDiagram,
  isPlaying,
  dragTargetPanelId,
  unparentCandidatePanelId,
  connectionCountPerNode,
  effectiveHandleOrder,
  onReorderHandle,
  flowHighlight,
  activeStep,
  flowBadges,
  coverage,
  isViewingCoverage,
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

  const { isRecording, onRecordHandleClick } = useFlowMode();
  const pendingPreviews = useLLMStore((state) => state.pendingPreviews);
  const pendingNodeIds = useMemo(() => getPendingNodeIds(pendingPreviews), [pendingPreviews]);

  // Stabilize Sets by content so they don't cause unnecessary dataCtx re-creation on
  // selection/highlight toggles that only add/remove a single member.
  const stablePanelIds = useStableSetByContent(panelIds);
  const stableSelectedNodeIds = useStableSetByContent(selectedNodeIds);
  const stableHighlightedNodeIds = useStableSetByContent(highlightedNodeIds);

  // Derive only what the descriptors need — avoids flows array identity changing on every render.
  const flowsForDescriptor = useMemo(() => flows.map((f) => ({ id: f.id, name: f.name })), [flows]);

  /** One walk over the scripts for the whole diagram, not one per route node. */
  const endpointCallsByRoute = useMemo(() => endpointCallersByRoute(flows), [flows]);

  const callbacksRef = useRef({
    handleDrillDown,
    navigateToDiagram,
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
    navigateToDiagram,
    onRecordHandleClick,
    onPanelCollapseToggle: handlePanelCollapseToggle,
    onReorderHandle,
    onPlayFlow,
    onAddEndpointToGroup,
    setNoteInlineEditingId,
    setJsonViewerInlineEditingId,
    updateComponent,
  };

  const prevNodeDataRef = useRef<
    Map<
      string,
      {
        data: Record<string, unknown>;
        style: CSSProperties | undefined;
        position: { x: number; y: number };
      }
    >
  >(new Map());

  const prevRfNodesByIdRef = useRef<Map<string, Node>>(new Map());
  const prevNodesArrayRef = useRef<Node[]>(EMPTY_CANVAS_NODE_LIST);

  const dataCtx: DataCtx | null = useMemo(() => {
    if (!diagram) return null;
    return {
      flows: flowsForDescriptor,
      endpointCallsByRoute,
      resolvedComponents,
      resolvedNodeLayouts,
      sceneBadgeByComponentId,
      compareVisualByComponentId,
      isCompareMode,
      serviceCatalog: serviceCatalog ?? {},
      allDiagrams,
      selectedNodeId,
      selectedNodeIds: stableSelectedNodeIds,
      dragTargetPanelId,
      unparentCandidatePanelId,
      panelIds: stablePanelIds,
      connectionCounts: connectionCountPerNode,
      effectiveHandleOrder,
      highlightedNodeIds: stableHighlightedNodeIds,
      isViewingCoverage,
      childrenIndex: buildChildrenIndex(resolvedComponents),
    };
  }, [
    diagram,
    resolvedComponents,
    resolvedNodeLayouts,
    sceneBadgeByComponentId,
    compareVisualByComponentId,
    isCompareMode,
    serviceCatalog,
    allDiagrams,
    selectedNodeId,
    stableSelectedNodeIds,
    dragTargetPanelId,
    unparentCandidatePanelId,
    stablePanelIds,
    connectionCountPerNode,
    effectiveHandleOrder,
    stableHighlightedNodeIds,
    isViewingCoverage,
    flowsForDescriptor,
    endpointCallsByRoute,
  ]);

  const nodeCtxPlayback = useMemo(
    () => ({
      isPlaying,
      isRecording,
      flowHighlight,
      activeStep,
      flowBadges,
      coverage,
    }),
    [isPlaying, isRecording, flowHighlight, activeStep, flowBadges, coverage],
  );

  return useMemo(() => {
    const diagram = diagramRef.current;
    if (!dataCtx || !diagram) {
      prevRfNodesByIdRef.current.clear();
      prevNodesArrayRef.current = EMPTY_CANVAS_NODE_LIST;
      return EMPTY_CANVAS_NODE_LIST;
    }

    const sceneActive = diagramSceneState?.hasActiveScene ?? false;

    const { highlightedNodeIds: hIds, isViewingCoverage: viewingCov, ...restForCtx } = dataCtx;

    const ctx: NodeBuildContext = {
      diagram,
      ...restForCtx,
      ...callbacksRef.current,
      ...nodeCtxPlayback,
    };

    const compareVisual = dataCtx.compareVisualByComponentId;
    const isCmp = dataCtx.isCompareMode ?? false;
    /**
     * A flow being read is a stage, not a workbench: the diagram is there to be
     * followed, and nothing on it should move, join up or take a selection.
     *
     * The gate has to be here rather than only on `<ReactFlow>`. A node that
     * states `draggable` / `selectable` / `connectable` for itself outranks the
     * canvas-wide `nodesDraggable` / `elementsSelectable` / `nodesConnectable`,
     * so a reading that only turned those off still let a node be dragged into
     * a new position — and saved it.
     */
    const isReading = ctx.isPlaying;
    const flowModeActive = ctx.isPlaying || ctx.isRecording;

    const visibleIds = new Set(view.nodes.map((viewNode) => viewNode.component.id));
    for (const cachedId of prevNodeDataRef.current.keys()) {
      if (!visibleIds.has(cachedId)) prevNodeDataRef.current.delete(cachedId);
    }
    for (const cachedId of prevRfNodesByIdRef.current.keys()) {
      if (!visibleIds.has(cachedId)) prevRfNodesByIdRef.current.delete(cachedId);
    }

    // The base every surface draws (placement, nesting, z-index, order,
    // visibility, data and size) — the viewer runs the same projection. What
    // follows only the editor has, as overlays that cannot move anything.
    const projected = projectNodes(view, ctx, EDITOR_PROJECTION, resolveNodeDescriptor);

    const nextNodes = projected.map((base, index): Node => {
      const viewNode = view.nodes[index]!;
      const comp = viewNode.component;
      const node = applyEditorNodeOverlays(base, viewNode, {
        selectedNodeIds: dataCtx.selectedNodeIds,
        highlightedNodeIds: hIds,
        flowModeActive,
        isViewingCoverage: viewingCov,
        coverage: nodeCtxPlayback.coverage,
        isCompareMode: isCmp,
        compareVisual: compareVisual?.[comp.id],
        hiddenByTag: isNodeHiddenByTagFilter(comp),
        isReading,
        locked: comp.locked === true || isAncestorLocked(comp, dataCtx.resolvedComponents),
        lockedByScene: sceneActive && !isComponentAddedInActiveScene(diagram, comp.id),
        pending: pendingNodeIds.has(comp.id),
      });

      // Identity cache, unchanged: React Flow keeps the previous object unless
      // what it draws actually moved.
      const newData = node.data as Record<string, unknown>;
      const newStyle = node.style as CSSProperties;
      const newPosX = node.position.x;
      const newPosY = node.position.y;
      const cached = prevNodeDataRef.current.get(comp.id);
      const stableData =
        cached && shallowEqualIgnoringFunctions(cached.data, newData) ? cached.data : newData;
      const stableStyle =
        cached && shallowEqualStyle(cached.style, newStyle) ? cached.style : newStyle;
      const stablePosition =
        cached && cached.position.x === newPosX && cached.position.y === newPosY
          ? cached.position
          : { x: newPosX, y: newPosY };
      prevNodeDataRef.current.set(comp.id, {
        data: stableData,
        style: stableStyle,
        position: stablePosition,
      });

      const built: Node = {
        ...node,
        position: stablePosition,
        style: stableStyle,
        data: stableData,
      };

      const prevRf = prevRfNodesByIdRef.current.get(comp.id);
      const nodeToUse = prevRf && isSameBuiltFlowNode(prevRf, built) ? prevRf : built;
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
  }, [diagramSceneState, dataCtx, nodeCtxPlayback, view, isNodeHiddenByTagFilter, pendingNodeIds]);
}
