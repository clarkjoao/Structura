/**
 * Handlers de eventos do canvas (click, selection, connect, etc.).
 * Recebe store, visual state e flow state para evitar duplicação no Canvas.
 */
import { useCallback } from "react";
import type { Node, Edge, OnEdgesChange, OnConnect, OnConnectEnd, Connection } from "@xyflow/react";
import type { CanvasVisualState } from "./useCanvasVisualState";
import { useRecordingMode } from "../flow/RecordingModeContext";

interface UseCanvasEventHandlersParams {
  visualState: CanvasVisualState;
  isPlaying: boolean;
  updateViewport: (vp: { x: number; y: number; zoom: number }) => void;
  addConnection: (source: string, target: string, label: string) => void;
  screenToFlowPosition: (pos: { x: number; y: number }) => { x: number; y: number };
}

export function useCanvasEventHandlers({
  visualState,
  isPlaying,
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
      if (isRecording) {
        if (node.type !== "panel" && node.type !== "note") onRecordNodeClick?.(node.id);
        return;
      }
      if (isPlaying) return;
      clearHighlight();
      setSelectedEdgeId(null);
      setContextMenu(null);
      if (e.metaKey || e.ctrlKey) {
        setSelectedNodeIds((prev) => {
          const next = new Set(prev);
          if (next.has(node.id)) next.delete(node.id);
          else next.add(node.id);
          setSelectedNodeId(
            next.size === 0 ? null : next.has(node.id) ? node.id : (next.values().next().value ?? null),
          );
          return next;
        });
      } else {
        setSelectedNodeIds(new Set([node.id]));
        setSelectedNodeId(node.id);
      }
    },
    [clearHighlight, isPlaying, isRecording, onRecordNodeClick, setSelectedNodeId, setSelectedNodeIds, setSelectedEdgeId, setContextMenu],
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (isRecording) {
        onRecordEdgeClick?.(edge.id, edge.sourceHandle ?? undefined);
        return;
      }
      clearHighlight();
      setSelectedEdgeId(edge.id);
      setSelectedNodeId(null);
      setSelectedNodeIds(new Set());
      setContextMenu(null);
    },
    [clearHighlight, isRecording, onRecordEdgeClick, setSelectedEdgeId, setSelectedNodeId, setSelectedNodeIds, setContextMenu],
  );

  const onSelectionChange = useCallback(
    ({ nodes: updatedNodes }: { nodes: Node[]; edges: Edge[] }) => {
      if(!updatedNodes.length) return;
      const ids = new Set(updatedNodes.filter((n) => n.selected).map((n) => n.id));
      setSelectedNodeIds(ids);
      setSelectedNodeId(updatedNodes.find((n) => n.selected)?.id ?? null);
    },
    [setSelectedNodeId, setSelectedNodeIds],
  );

  const onPaneClick = useCallback(() => {
    clearCanvasSelection();
  }, [clearCanvasSelection]);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (isRecording) return;
      event.preventDefault();
      clearHighlight();
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
    clearHighlight();
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, [clearHighlight, setSelectedNodeId, setSelectedEdgeId]);

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
