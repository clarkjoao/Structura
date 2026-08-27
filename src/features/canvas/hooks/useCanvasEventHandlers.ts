import { useCallback, useRef } from "react";
import type { Node, Edge, OnEdgesChange, OnConnect, Connection } from "@xyflow/react";
import { useReactFlow } from "@xyflow/react";
import { useTranslation } from "react-i18next";
import type { CanvasVisualState } from "./useCanvasVisualState";
import { useFlowMode } from "../flow/FlowModeContext";
import {
  isReactFlowParentPanelType,
  isNoteType,
  isEndpointType,
  isJsonViewerType,
} from "@/features/diagram";
import type { EdgeStyle } from "@/features/diagram";
import { getLastEdgeStyle } from "@/features/diagram";
import { getNodeType } from "../utils/node-type-utils";
import { dragSelectionRef } from "./useLocalNodes";
import { usePointerFunnel, type GestureTarget } from "../selection/pointerFunnel";

interface UseCanvasEventHandlersParams {
  visualState: CanvasVisualState;
  isPlaying: boolean;
  isCompareMode?: boolean;
  isFlowPanelOpen: boolean;
  updateViewport: (vp: { x: number; y: number; zoom: number }) => void;
  addConnection: (source: string, target: string, label: string, edgeStyle?: EdgeStyle) => void;
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number };
  onRequestFocusTitle?: () => void;
}

function getEventClientPoint(event: MouseEvent | TouchEvent): { x: number; y: number } | null {
  if (event instanceof MouseEvent) {
    return { x: event.clientX, y: event.clientY };
  }

  const touch = event.changedTouches[0] ?? event.touches[0];
  if (!touch) return null;
  return { x: touch.clientX, y: touch.clientY };
}

export function useCanvasEventHandlers({
  visualState,
  isPlaying,
  isCompareMode = false,
  isFlowPanelOpen,
  updateViewport,
  addConnection,
  screenToFlowPosition,
  onRequestFocusTitle,
}: UseCanvasEventHandlersParams) {
  const { t } = useTranslation();
  const { isRecording, onRecordNodeClick, onRecordEdgeClick } = useFlowMode();
  const reactFlowInstance = useReactFlow();
  const {
    setSelectedNodeId,
    setSelectedNodeIds,
    setSelectedEdgeId,
    setContextMenu,
    setQuickInsert,
    setPaneContextMenu,
    clearHighlight,
    clearCanvasSelection,
  } = visualState;

  /**
   * Right-button context-menu opener (decisions #7 + #8). Lives in the
   * pointer funnel and fires on pointerup if the gesture stayed below the
   * 4 px threshold. Above the threshold the funnel does not call back —
   * React Flow's `panOnDrag=[1,2]` handles the drag-pan.
   */
  const openContextMenuFromFunnel = useCallback(
    (target: GestureTarget, atScreen: { x: number; y: number }) => {
      if (isRecording || isCompareMode || isPlaying || isFlowPanelOpen) return;
      const isOnNode =
        target.kind === "node" ||
        target.kind === "panel-header" ||
        target.kind === "panel-border" ||
        target.kind === "panel-body";
      if (isOnNode) {
        const nodeId = target.nodeId;
        const node = reactFlowInstance.getNodes().find((n) => n.id === nodeId);
        if (!node) return;
        // Mirror the legacy onNodeContextMenu body verbatim — the menu
        // position and selection-restore logic must not diverge.
        if (isRecording || isCompareMode) return;
        clearHighlight();
        setContextMenu({ x: atScreen.x, y: atScreen.y, elementId: node.id });
        setPaneContextMenu(null);
        setSelectedNodeId(node.id);
        setSelectedNodeIds((prev) => {
          const next = prev.has(node.id) ? prev : new Set([node.id]);
          prevSelectionRef.current = [...next].sort().join(",");
          return next;
        });
        setSelectedEdgeId(null);
        return;
      }
      // Pane: open quick insert.
      if (
        visualState.selectedNodeId ||
        visualState.selectedEdgeId ||
        visualState.selectedNodeIds.size > 0
      ) {
        return;
      }
      clearHighlight();
      setContextMenu(null);
      setPaneContextMenu(null);
      const flowPos = screenToFlowPosition(atScreen);
      setQuickInsert({ screenPos: atScreen, flowPos, sourceNodeId: null });
    },
    [
      clearHighlight,
      isCompareMode,
      isPlaying,
      isFlowPanelOpen,
      isRecording,
      reactFlowInstance,
      screenToFlowPosition,
      setContextMenu,
      setPaneContextMenu,
      setQuickInsert,
      setSelectedEdgeId,
      setSelectedNodeId,
      setSelectedNodeIds,
      visualState.selectedNodeId,
      visualState.selectedEdgeId,
      visualState.selectedNodeIds,
    ],
  );

  /**
   * Decision #1 — a click in a panel's empty interior is a background click.
   * Same function the pane click uses, so the two paths cannot drift.
   */
  const clearSelectionFromPanelBody = useCallback(() => {
    prevSelectionRef.current = "";
    setQuickInsert(null);
    clearCanvasSelection();
  }, [clearCanvasSelection, setQuickInsert]);

  /**
   * Decision #8 — right-button pan over a node or a panel.
   *
   * Only the funnel calls this, and only for presses d3-zoom refused (inside
   * `.nopan`). `setViewport` with `duration: 0` goes through React Flow's own
   * pan-zoom instance, so the transform, the `onMove`/`onMoveEnd` round-trip
   * and therefore `updateViewport`'s persistence all behave exactly as they do
   * for a pane pan — there is no second viewport source of truth.
   */
  const panViewportBy = useCallback(
    (dx: number, dy: number) => {
      if (isPlaying || isFlowPanelOpen) return;
      const vp = reactFlowInstance.getViewport();
      reactFlowInstance.setViewport({ x: vp.x + dx, y: vp.y + dy, zoom: vp.zoom }, { duration: 0 });
    },
    [reactFlowInstance, isPlaying, isFlowPanelOpen],
  );

  const funnel = usePointerFunnel({
    openContextMenu: openContextMenuFromFunnel,
    onBackgroundClick: clearSelectionFromPanelBody,
    panViewportBy,
  });

  const onEdgesChange: OnEdgesChange = useCallback(() => {}, []);

  const onMoveEnd = useCallback(
    (_: unknown, vp: { x: number; y: number; zoom: number }) => {
      updateViewport(vp);
    },
    [updateViewport],
  );

  const onConnect: OnConnect = useCallback(
    (c: Connection) => {
      if (c.source && c.target) {
        addConnection(c.source, c.target, t("canvas.usesEdgeLabel"), getLastEdgeStyle());
      }
    },
    [addConnection, t],
  );

  const onConnectEnd = useCallback(
    (
      event: MouseEvent | TouchEvent,
      connectionState: { fromNode: Node | null; toNode: Node | null },
    ) => {
      if (isRecording) return;
      if (connectionState.fromNode === null || connectionState.toNode !== null) return;
      const clientPoint = getEventClientPoint(event);
      if (!clientPoint) return;
      const flowPos = screenToFlowPosition({
        x: clientPoint.x,
        y: clientPoint.y,
      });
      setQuickInsert({
        screenPos: { x: clientPoint.x, y: clientPoint.y },
        flowPos,
        sourceNodeId: connectionState.fromNode.id,
      });
    },
    [isRecording, screenToFlowPosition, setQuickInsert],
  );

  const handleQuickInsert = useCallback(
    (_newNodeId: string) => {
      setQuickInsert(null);
    },
    [setQuickInsert],
  );

  const onNodeClick = useCallback(
    (e: React.MouseEvent, node: Node) => {
      setQuickInsert(null);
      setPaneContextMenu(null);
      const nodeType = getNodeType(node);
      if (isEndpointType(nodeType) && node.parentId) {
        if (isCompareMode) return;
        if (!isRecording) {
          clearHighlight();
          setSelectedEdgeId(null);
          setContextMenu(null);
          setSelectedNodeId(node.parentId);
          setSelectedNodeIds(new Set([node.parentId]));
        } else {
          onRecordNodeClick?.(node.id);
        }
        return;
      }
      if (isRecording) {
        if (
          !isReactFlowParentPanelType(nodeType) &&
          !isNoteType(nodeType) &&
          !isJsonViewerType(nodeType)
        ) {
          onRecordNodeClick?.(node.id);
        }
        return;
      }
      if (isCompareMode) return;
      if (isPlaying || isFlowPanelOpen) return;
      clearHighlight();
      setSelectedEdgeId(null);
      setContextMenu(null);
      if (e.metaKey || e.ctrlKey || e.shiftKey) {
        // The pointer funnel (decision #3) writes selection on pointerdown —
        // by the time `onClick` runs, the round-trip has already settled.
        // Toggling again here would undo the funnel's write, and since
        // `selected` flows store -> nodes -> React Flow, the two sides
        // would keep correcting each other.
        return;
      }
      if (funnel.consumedClick(node.id)) {
        // Same race protection when the funnel replaced the selection with
        // just this node on pointerdown (decision #3 — replace half).
        return;
      }
      prevSelectionRef.current = node.id;
      setSelectedNodeIds(new Set([node.id]));
      setSelectedNodeId(node.id);
    },
    [
      clearHighlight,
      isCompareMode,
      isPlaying,
      isFlowPanelOpen,
      isRecording,
      onRecordNodeClick,
      setSelectedNodeId,
      setSelectedNodeIds,
      setSelectedEdgeId,
      setContextMenu,
      setQuickInsert,
      setPaneContextMenu,
      funnel,
    ],
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      setQuickInsert(null);
      setPaneContextMenu(null);
      if (isRecording) {
        onRecordEdgeClick?.(edge.id, edge.sourceHandle ?? undefined);
        return;
      }
      if (isCompareMode) return;
      if (isFlowPanelOpen) return;
      clearHighlight();
      setSelectedEdgeId(edge.id);
      setSelectedNodeId(null);
      setSelectedNodeIds((prev) => (prev.size === 0 ? prev : new Set()));
      setContextMenu(null);
    },
    [
      clearHighlight,
      isCompareMode,
      isFlowPanelOpen,
      isRecording,
      onRecordEdgeClick,
      setSelectedEdgeId,
      setSelectedNodeId,
      setSelectedNodeIds,
      setContextMenu,
      setQuickInsert,
      setPaneContextMenu,
    ],
  );

  const prevSelectionRef = useRef<string>("");

  const onSelectionChange = useCallback(
    ({ nodes: updatedNodes }: { nodes: Node[]; edges: Edge[] }) => {
      const selectedIds = updatedNodes.filter((n) => n.selected).map((n) => n.id);
      const selectedSet = new Set(selectedIds);

      if (isCompareMode) return;
      const key = [...selectedIds].sort().join(",");
      if (key === prevSelectionRef.current) return;
      prevSelectionRef.current = key;

      // Draw.io parity: if we're in a drag gesture and previously had selected nodes,
      // merge the dragged node with the previous selection so all move together
      if (dragSelectionRef.isDragging && dragSelectionRef.selectedBeforeDrag.size > 0) {
        // Merge: add previously selected nodes to the current selection
        const mergedIds = new Set([...selectedIds, ...dragSelectionRef.selectedBeforeDrag]);
        const mergedKey = [...mergedIds].sort().join(",");

        // Only update if selection actually changed
        if (mergedKey !== key) {
          // An empty list is a real deselection and must reach the store
          if (mergedIds.size > 0) {
            setSelectedEdgeId(null);
            setContextMenu(null);
            setPaneContextMenu(null);
          }

          setSelectedNodeIds((prev) => {
            if (prev.size === mergedIds.size && [...mergedIds].every((id) => prev.has(id))) {
              return prev;
            }
            return mergedIds;
          });
          setSelectedNodeId(selectedIds[0] ?? null);
        }

        // Clear drag tracking after processing
        dragSelectionRef.selectedBeforeDrag.clear();
        dragSelectionRef.isDragging = false;
        return;
      }

      // Normal selection change (not during drag)
      if (selectedIds.length > 0) {
        setSelectedEdgeId(null);
        setContextMenu(null);
        setPaneContextMenu(null);
      }
      // React Flow reports its selection back to us after we push `selected` into the nodes, so
      // write a new Set only on a real content change — an identity-only write would re-render the
      // canvas and bounce right back here.
      setSelectedNodeIds((prev) => {
        if (prev.size === selectedIds.length && selectedIds.every((id) => prev.has(id))) {
          return prev;
        }
        return new Set(selectedIds);
      });
      setSelectedNodeId(selectedIds[0] ?? null);
    },
    [
      isCompareMode,
      setSelectedNodeId,
      setSelectedNodeIds,
      setSelectedEdgeId,
      setContextMenu,
      setPaneContextMenu,
    ],
  );

  const onNodeDoubleClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (isCompareMode || isPlaying || isFlowPanelOpen || isRecording) return;
      clearHighlight();
      setSelectedEdgeId(null);
      setContextMenu(null);
      setPaneContextMenu(null);
      prevSelectionRef.current = node.id;
      setSelectedNodeIds(new Set([node.id]));
      setSelectedNodeId(node.id);

      if (isJsonViewerType(getNodeType(node))) {
        const startEdit = node.data?.onStartEdit as (() => void) | undefined;
        startEdit?.();
        return;
      }

      onRequestFocusTitle?.();
    },
    [
      isCompareMode,
      isPlaying,
      isFlowPanelOpen,
      isRecording,
      clearHighlight,
      setSelectedEdgeId,
      setContextMenu,
      setSelectedNodeIds,
      setSelectedNodeId,
      setPaneContextMenu,
      onRequestFocusTitle,
    ],
  );

  const onEdgeDoubleClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (isCompareMode || isPlaying || isFlowPanelOpen || isRecording) return;
      clearHighlight();
      setSelectedNodeId(null);
      setSelectedNodeIds(new Set());
      setContextMenu(null);
      setPaneContextMenu(null);
      setSelectedEdgeId(edge.id);
      onRequestFocusTitle?.();
    },
    [
      isCompareMode,
      isPlaying,
      isFlowPanelOpen,
      isRecording,
      clearHighlight,
      setSelectedNodeId,
      setSelectedNodeIds,
      setSelectedEdgeId,
      setContextMenu,
      setPaneContextMenu,
      onRequestFocusTitle,
    ],
  );

  const onPaneClick = useCallback(() => {
    prevSelectionRef.current = "";
    setQuickInsert(null);
    clearCanvasSelection();
  }, [clearCanvasSelection, setQuickInsert]);

  const onPaneContextMenu = useCallback(
    (event: MouseEvent | React.MouseEvent) => {
      event.preventDefault();
      if (isRecording || isCompareMode || isPlaying || isFlowPanelOpen) return;
      if (
        visualState.selectedNodeId ||
        visualState.selectedEdgeId ||
        visualState.selectedNodeIds.size > 0
      ) {
        return;
      }
      clearHighlight();
      setContextMenu(null);
      setPaneContextMenu(null);
      const flowPos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      setQuickInsert({
        screenPos: { x: event.clientX, y: event.clientY },
        flowPos,
        sourceNodeId: null,
      });
    },
    [
      isRecording,
      isCompareMode,
      isPlaying,
      isFlowPanelOpen,
      visualState.selectedNodeId,
      visualState.selectedEdgeId,
      visualState.selectedNodeIds,
      clearHighlight,
      setContextMenu,
      setQuickInsert,
      setPaneContextMenu,
      screenToFlowPosition,
    ],
  );

  /**
   * Decision #7 — the node context menu must open on RELEASE of the right
   * button, never on press: "se clicar e segurar, o usuário quer arrastar".
   *
   * This handler used to open the menu itself. React Flow wires it to the
   * node element's React `onContextMenu`, i.e. to the native `contextmenu`
   * event, and that path has no drag-threshold gate — so it defeated the
   * funnel's gate on every platform, in two different ways:
   *
   *  - macOS fires `contextmenu` on MOUSEDOWN. The menu appeared the instant
   *    the button went down, before the user could move a pixel.
   *  - Windows/Linux fire it after `mouseup`. The funnel correctly withheld
   *    the menu after a >= `DRAG_THRESHOLD_PX` right-drag, and then this
   *    handler opened it anyway a moment later.
   *
   * The opening logic now lives exclusively in `openContextMenuFromFunnel`,
   * which fires from `pointerup` and is threshold-gated. All that is left to
   * do here is suppress Chrome's own menu; the funnel decides the rest.
   */
  const onNodeContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
  }, []);

  const closePanel = useCallback(() => {
    prevSelectionRef.current = "";
    clearHighlight();
    setSelectedNodeId(null);
    setSelectedNodeIds((prev) => (prev.size === 0 ? prev : new Set()));
    setSelectedEdgeId(null);
  }, [clearHighlight, setSelectedNodeId, setSelectedNodeIds, setSelectedEdgeId]);

  // Return handlers as a plain object — React Flow diffs by name, not reference,
  // so a new object each render is fine and avoids the useMemo overhead of 12 deps.
  return {
    onEdgesChange,
    onMoveEnd,
    onConnect,
    onConnectEnd,
    onNodeClick,
    onEdgeClick,
    onNodeDoubleClick,
    onEdgeDoubleClick,
    onSelectionChange,
    onPaneClick,
    onPaneContextMenu,
    onNodeContextMenu,
    handleQuickInsert,
    closePanel,
    /**
     * Phase 4 — exposed for the Esc handler (decision #5, layer 1). Returns
     * true if a gesture was actually cancelled.
     */
    cancelInFlightGesture: funnel.cancelInFlightGesture,
  };
}
