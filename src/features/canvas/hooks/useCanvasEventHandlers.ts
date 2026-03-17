/**
 * Handlers de eventos do canvas (click, selection, connect, etc.).
 * Recebe store, visual state e flow state para evitar duplicação no Canvas.
 */
import { useCallback, useRef } from "react";
import type { Node, Edge, OnEdgesChange, OnConnect, OnConnectEnd, Connection } from "@xyflow/react";
import type { CanvasVisualState } from "./useCanvasVisualState";
import { useRecordingMode } from "../flow/RecordingModeContext";
import { isPanelType, isNoteType, isEndpointType } from "@/features/diagram";

interface UseCanvasEventHandlersParams {
  visualState: CanvasVisualState;
  isPlaying: boolean;
  isFlowPanelOpen: boolean;
  updateViewport: (vp: { x: number; y: number; zoom: number }) => void;
  addConnection: (source: string, target: string, label: string) => void;
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number };
}

export function useCanvasEventHandlers({
  visualState,
  isPlaying,
  isFlowPanelOpen,
  updateViewport,
  addConnection,
  screenToFlowPosition,
}: UseCanvasEventHandlersParams) {
  const { isRecording, onRecordNodeClick, onRecordEdgeClick } = useRecordingMode();
  const {
    setSelectedNodeId,
    setSelectedNodeIds,
    setSelectedEdgeId,
    setContextMenu,
    setQuickInsert,
    clearHighlight,
    clearCanvasSelection,
  } = visualState;

  const onEdgesChange: OnEdgesChange = useCallback(() => {}, []);

  const onMoveEnd = useCallback(
    (_: unknown, vp: { x: number; y: number; zoom: number }) => {
      updateViewport(vp);
    },
    [updateViewport],
  );

  const onConnect: OnConnect = useCallback(
    (c: Connection) => {
      if (c.source && c.target) addConnection(c.source, c.target, "Usa");
    },
    [addConnection],
  );

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, connectionState: { fromNode: Node | null; toNode: Node | null }) => {
      if (isRecording) return;
      if (connectionState.fromNode === null || connectionState.toNode !== null) return;
      if (!(event instanceof MouseEvent)) return;
      const flowPos = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      setQuickInsert({
        screenPos: { x: event.clientX, y: event.clientY },
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
      const nodeType = (node.type as string) ?? "";
      if (isEndpointType(nodeType) && node.parentId) {
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
        if (!isPanelType(nodeType) && !isNoteType(nodeType)) onRecordNodeClick?.(node.id);
        return;
      }
      if (isPlaying || isFlowPanelOpen) return;
      clearHighlight();
      setSelectedEdgeId(null);
      setContextMenu(null);
      if (e.metaKey || e.ctrlKey) {
        setSelectedNodeIds((prev) => {
          const next = new Set(prev);
          if (next.has(node.id)) next.delete(node.id);
          else next.add(node.id);
          prevSelectionRef.current = [...next].sort().join(",");
          setSelectedNodeId(
            next.size === 0 ? null : next.has(node.id) ? node.id : (next.values().next().value ?? null),
          );
          return next;
        });
      } else {
        prevSelectionRef.current = node.id;
        setSelectedNodeIds(new Set([node.id]));
        setSelectedNodeId(node.id);
      }
    },
    [clearHighlight, isPlaying, isFlowPanelOpen, isRecording, onRecordNodeClick, setSelectedNodeId, setSelectedNodeIds, setSelectedEdgeId, setContextMenu],
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (isRecording) {
        onRecordEdgeClick?.(edge.id, edge.sourceHandle ?? undefined);
        return;
      }
      if (isFlowPanelOpen) return;
      clearHighlight();
      setSelectedEdgeId(edge.id);
      setSelectedNodeId(null);
      setSelectedNodeIds((prev) => (prev.size === 0 ? prev : new Set()));
      setContextMenu(null);
    },
    [clearHighlight, isFlowPanelOpen, isRecording, onRecordEdgeClick, setSelectedEdgeId, setSelectedNodeId, setSelectedNodeIds, setContextMenu],
  );

  const prevSelectionRef = useRef<string>("");
  const onSelectionChange = useCallback(
    ({ nodes: updatedNodes }: { nodes: Node[]; edges: Edge[] }) => {
      const selectedIds = updatedNodes.filter((n) => n.selected).map((n) => n.id);
      // Skip empty selections (handled by onPaneClick) and duplicate firings
      if (selectedIds.length === 0) return;
      const key = selectedIds.sort().join(",");
      if (key === prevSelectionRef.current) return;
      prevSelectionRef.current = key;
      setSelectedNodeIds(new Set(selectedIds));
      setSelectedNodeId(selectedIds[0] ?? null);
    },
    [setSelectedNodeId, setSelectedNodeIds],
  );

  const onPaneClick = useCallback(() => {
    prevSelectionRef.current = "";
    clearCanvasSelection();
  }, [clearCanvasSelection]);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (isRecording) return;
      event.preventDefault();
      clearHighlight();
      prevSelectionRef.current = node.id;
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        elementId: node.id,
      });
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
    },
    [clearHighlight, isRecording, setContextMenu, setSelectedNodeId, setSelectedEdgeId],
  );

  const closePanel = useCallback(() => {
    prevSelectionRef.current = "";
    clearHighlight();
    setSelectedNodeId(null);
    setSelectedNodeIds((prev) => (prev.size === 0 ? prev : new Set()));
    setSelectedEdgeId(null);
  }, [clearHighlight, setSelectedNodeId, setSelectedNodeIds, setSelectedEdgeId]);

  return {
    onEdgesChange,
    onMoveEnd,
    onConnect,
    onConnectEnd,
    onNodeClick,
    onEdgeClick,
    onSelectionChange,
    onPaneClick,
    onNodeContextMenu,
    handleQuickInsert,
    closePanel,
  };
}
