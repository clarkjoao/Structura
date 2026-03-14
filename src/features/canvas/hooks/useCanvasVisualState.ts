/**
 * Estado visual do canvas (não persiste no store).
 * Seleção, highlight, context menu, quick insert, pulse, drag positions.
 */
import { useCallback, useState } from "react";

export interface CanvasVisualState {
  selectedNodeId: string | null;
  setSelectedNodeId: (id: string | null) => void;
  selectedNodeIds: Set<string>;
  setSelectedNodeIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  selectedEdgeId: string | null;
  setSelectedEdgeId: (id: string | null) => void;
  highlightedConnectionId: string | null;
  highlightedNodeIds: Set<string>;
  setHighlight: (connectionId: string, nodeIds: string[]) => void;
  clearHighlight: () => void;
  contextMenu: { x: number; y: number; elementId: string } | null;
  setContextMenu: (menu: { x: number; y: number; elementId: string } | null) => void;
  quickInsert: {
    screenPos: { x: number; y: number };
    flowPos: { x: number; y: number };
    sourceNodeId: string;
  } | null;
  setQuickInsert: (value: CanvasVisualState["quickInsert"]) => void;
  pulseNodeId: string | null;
  setPulseNodeId: (id: string | null) => void;
  dragPositions: Record<string, { x: number; y: number }>;
  setDragPositions: React.Dispatch<React.SetStateAction<Record<string, { x: number; y: number }>>>;
  clearCanvasSelection: () => void;
}

export function useCanvasVisualState(): CanvasVisualState {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [highlightedConnectionId, setHighlightedConnectionId] = useState<string | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set());
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    elementId: string;
  } | null>(null);
  const [quickInsert, setQuickInsert] = useState<{
    screenPos: { x: number; y: number };
    flowPos: { x: number; y: number };
    sourceNodeId: string;
  } | null>(null);
  const [pulseNodeId, setPulseNodeId] = useState<string | null>(null);
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({});

  const setHighlight = useCallback((connectionId: string, nodeIds: string[]) => {
    setHighlightedConnectionId(connectionId);
    setHighlightedNodeIds(new Set(nodeIds));
  }, []);

  const clearHighlight = useCallback(() => {
    setHighlightedConnectionId(null);
    setHighlightedNodeIds(new Set());
  }, []);

  const clearCanvasSelection = useCallback(() => {
    clearHighlight();
    setSelectedNodeId(null);
    setSelectedNodeIds(new Set());
    setSelectedEdgeId(null);
    setContextMenu(null);
  }, [clearHighlight]);

  return {
    selectedNodeId,
    setSelectedNodeId,
    selectedNodeIds,
    setSelectedNodeIds,
    selectedEdgeId,
    setSelectedEdgeId,
    highlightedConnectionId,
    highlightedNodeIds,
    setHighlight,
    clearHighlight,
    contextMenu,
    setContextMenu,
    quickInsert,
    setQuickInsert,
    pulseNodeId,
    setPulseNodeId,
    dragPositions,
    setDragPositions,
    clearCanvasSelection,
  };
}
