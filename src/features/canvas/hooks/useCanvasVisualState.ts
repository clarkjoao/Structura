import { useCallback, useEffect, useRef, useState } from "react";
import type { Component } from "@/features/diagram";

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
    sourceNodeId?: string | null;
  } | null;
  setQuickInsert: (value: CanvasVisualState["quickInsert"]) => void;
  clearCanvasSelection: () => void;
  hiddenTags: Set<string>;
  toggleTag: (tag: string) => void;
  showAllTags: () => void;
  isNodeHiddenByTagFilter: (component: Component) => boolean;
}

export function useCanvasVisualState(activeDiagramId: string | null): CanvasVisualState {
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
    sourceNodeId?: string | null;
  } | null>(null);
  const [hiddenTags, setHiddenTags] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setHiddenTags(new Set());
  }, [activeDiagramId]);

  const toggleTag = useCallback((tag: string) => {
    setHiddenTags((previous) => {
      const next = new Set(previous);
      if (next.has(tag)) {
        next.delete(tag);
      } else {
        next.add(tag);
      }
      return next;
    });
  }, []);

  const showAllTags = useCallback(() => {
    setHiddenTags(new Set());
  }, []);

  const isNodeHiddenByTagFilter = useCallback(
    (component: Component): boolean => {
      if (!component.tags?.length) {
        return false;
      }
      return component.tags.some((tag) => hiddenTags.has(tag));
    },
    [hiddenTags],
  );

  const emptySet = useRef(new Set<string>()).current;

  const setHighlight = useCallback((connectionId: string, nodeIds: string[]) => {
    setHighlightedConnectionId(connectionId);
    setHighlightedNodeIds(new Set(nodeIds));
  }, []);

  const clearHighlight = useCallback(() => {
    setHighlightedConnectionId((prev) => prev === null ? prev : null);
    setHighlightedNodeIds((prev) => prev.size === 0 ? prev : emptySet);
  }, [emptySet]);

  const clearCanvasSelection = useCallback(() => {
    clearHighlight();
    setSelectedNodeId((prev) => prev === null ? prev : null);
    setSelectedNodeIds((prev) => prev.size === 0 ? prev : emptySet);
    setSelectedEdgeId((prev) => prev === null ? prev : null);
    setContextMenu((prev) => prev === null ? prev : null);
  }, [clearHighlight, emptySet]);

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
    clearCanvasSelection,
    hiddenTags,
    toggleTag,
    showAllTags,
    isNodeHiddenByTagFilter,
  };
}
