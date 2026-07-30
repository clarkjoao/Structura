import { useCallback, useEffect, useRef, useState } from "react";
import type { Component } from "@/features/diagram";
import { useCanvasSelection } from "./useCanvasSelection";
import { useCanvasHighlight } from "./useCanvasHighlight";
import { useCanvasContextMenus } from "./useCanvasContextMenus";

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
  paneContextMenu: { x: number; y: number } | null;
  setPaneContextMenu: (value: CanvasVisualState["paneContextMenu"]) => void;
  clearCanvasSelection: () => void;
  visibleTags: Set<string> | null;
  toggleTag: (tag: string) => void;
  showAllTags: () => void;
  showNoTags: () => void;
  isNodeHiddenByTagFilter: (component: Component) => boolean;

  noteInlineEditingId: string | null;
  setNoteInlineEditingId: (id: string | null) => void;

  jsonViewerInlineEditingId: string | null;
  setJsonViewerInlineEditingId: (id: string | null) => void;
}

/** Fields that affect how nodes render in React Flow */
export interface NodeSelectionState {
  selectedNodeId: string | null;
  selectedNodeIds: Set<string>;
  highlightedNodeIds: Set<string>;
  dragTargetPanelId: string | null;
  unparentCandidatePanelId: string | null;
  isNodeHiddenByTagFilter: (component: Component) => boolean;
}

export function useCanvasVisualState(activeDiagramId: string | null): CanvasVisualState {
  // Internal sub-hooks — each owns a focused slice of state.
  const selection = useCanvasSelection(activeDiagramId);
  const highlight = useCanvasHighlight();
  const menus = useCanvasContextMenus();

  const { clearSelection: clearStoreSelection } = selection;
  const { clearHighlight: clearHighlightFn } = highlight;

  const [visibleTags, setVisibleTags] = useState<Set<string> | null>(null);
  const [noteInlineEditingId, setNoteInlineEditingId] = useState<string | null>(null);
  const [jsonViewerInlineEditingId, setJsonViewerInlineEditingId] = useState<string | null>(null);

  useEffect(() => {
    setVisibleTags(null);
  }, [activeDiagramId]);

  const toggleTag = useCallback((tag: string) => {
    setVisibleTags((prev) => {
      const next = new Set(prev ?? []);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  }, []);

  const showAllTags = useCallback(() => setVisibleTags(null), []);
  const showNoTags = useCallback(() => setVisibleTags(new Set()), []);

  const isNodeHiddenByTagFilterImpl = useCallback(
    (component: Component): boolean => {
      if (visibleTags === null) return false;
      if (visibleTags.size === 0) return !!component.tags?.length;
      return !component.tags?.some((tag) => visibleTags.has(tag));
    },
    [visibleTags],
  );

  const clearCanvasSelectionImpl = useCallback(() => {
    clearHighlightFn();
    clearStoreSelection();
    menus.setContextMenu(null);
    menus.setPaneContextMenu(null);
    setNoteInlineEditingId(null);
    setJsonViewerInlineEditingId(null);
  }, [clearHighlightFn, clearStoreSelection, menus]);

  useEffect(() => {
    clearCanvasSelectionImpl();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDiagramId]);

  // Clear the connection highlight when node selection changes so it doesn't persist.
  useEffect(() => {
    clearHighlightFn();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection.selectedNodeId]);

  // Stable callbacks backed by ref to avoid stale closures in event handlers.
  const derivedRef = useRef({
    clearHighlight: clearHighlightFn,
    clearCanvasSelection: clearCanvasSelectionImpl,
    isNodeHiddenByTagFilter: isNodeHiddenByTagFilterImpl,
  });
  derivedRef.current.clearHighlight = clearHighlightFn;
  derivedRef.current.clearCanvasSelection = clearCanvasSelectionImpl;
  derivedRef.current.isNodeHiddenByTagFilter = isNodeHiddenByTagFilterImpl;

  const clearHighlight = useRef(() => {
    derivedRef.current.clearHighlight();
  }).current;

  const clearCanvasSelection = useRef(() => {
    derivedRef.current.clearCanvasSelection();
  }).current;

  const isNodeHiddenByTagFilter = useRef((component: Component) => {
    return derivedRef.current.isNodeHiddenByTagFilter(component);
  }).current;

  return {
    selectedNodeId: selection.selectedNodeId,
    selectedNodeIds: selection.selectedNodeIds,
    selectedEdgeId: selection.selectedEdgeId,
    highlightedConnectionId: highlight.highlightedConnectionId,
    highlightedNodeIds: highlight.highlightedNodeIds,
    contextMenu: menus.contextMenu,
    quickInsert: menus.quickInsert,
    paneContextMenu: menus.paneContextMenu,
    visibleTags,
    noteInlineEditingId,
    jsonViewerInlineEditingId,
    setSelectedNodeId: selection.setSelectedNodeId,
    setSelectedNodeIds: selection.setSelectedNodeIds,
    setSelectedEdgeId: selection.setSelectedEdgeId,
    setHighlight: highlight.setHighlight,
    setContextMenu: menus.setContextMenu,
    setQuickInsert: menus.setQuickInsert,
    setPaneContextMenu: menus.setPaneContextMenu,
    toggleTag,
    showAllTags,
    showNoTags,
    setNoteInlineEditingId,
    setJsonViewerInlineEditingId,
    clearHighlight,
    clearCanvasSelection,
    isNodeHiddenByTagFilter,
  };
}
