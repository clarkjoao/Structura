import { useCallback } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import type { Diagram, DiagramModel } from "@/features/diagram";
import {
  isModKeyPressed,
  keyMatchesLetter,
  keyIs,
  keyIsOneOf,
  getSelectedNodes,
  KEY,
  type KeyHandler,
} from "./helpers";

interface UseSelectionShortcutsParams {
  diagram: Diagram | DiagramModel | null | undefined;
  selectedNodeId: string | null;
  selectedEdgeId: string | null;
  reactFlowInstance: ReactFlowInstance;
  setSelectedNodeId: (id: string | null) => void;
  setSelectedNodeIds: (ids: Set<string> | ((prev: Set<string>) => Set<string>)) => void;
  setSelectedEdgeId: (id: string | null) => void;
  setContextMenu: (v: null) => void;
  clearClipboard: () => void;
  /** Clears the connection highlight a selected edge lights up (edge + both ends). */
  clearHighlight?: () => void;
  removeElements: (nodeIds: string[], edgeIds: string[]) => void;
  /**
   * Phase 4 — decision #5: Esc layered precedence, layer 1.
   * Returns true if there was an in-flight gesture to cancel.
   * Supplied by the pointer funnel owner (typically the canvas controller).
   */
  cancelInFlightGesture?: () => boolean;
  /**
   * Phase 4 — decision #5: Esc layered precedence, layer 2.
   * Returns true if a transient mode (focus/compare/flow playback) was
   * actually exited. The keyboard handler calls each in turn and stops at
   * the first that reports a change.
   */
  onExitFlowPlayback?: () => boolean;
  onExitFocusMode?: () => boolean;
  onExitCompareMode?: () => boolean;
}

export function useSelectionShortcuts({
  diagram,
  selectedNodeId,
  selectedEdgeId,
  reactFlowInstance,
  setSelectedNodeId,
  setSelectedNodeIds,
  setSelectedEdgeId,
  setContextMenu,
  clearClipboard,
  clearHighlight,
  removeElements,
  cancelInFlightGesture,
  onExitFlowPlayback,
  onExitFocusMode,
  onExitCompareMode,
}: UseSelectionShortcutsParams): KeyHandler {
  return useCallback(
    (e: KeyboardEvent): boolean => {
      if (!diagram) return false;
      const mod = isModKeyPressed(e);

      if (keyIs(e, KEY.ESCAPE)) {
        e.preventDefault();
        // Layer 1 — cancel in-progress gesture (decision #5).
        if (cancelInFlightGesture?.()) return true;
        // Layer 2 — exit transient mode. Each handler returns true only if
        // it actually exited something; otherwise the next layer runs.
        if (onExitCompareMode?.()) return true;
        if (onExitFlowPlayback?.()) return true;
        if (onExitFocusMode?.()) return true;
        // Layer 3 — clear selection. The store is the only source of `selected`
        // (see useLocalNodes); writing it into React Flow as well queues a
        // `replace` that lands after the store render and restores the node's
        // previous data, so the node kept its selection ring.
        clearClipboard();
        clearHighlight?.();
        setSelectedNodeId(null);
        setSelectedNodeIds(new Set());
        setSelectedEdgeId(null);
        setContextMenu(null);
        return true;
      }

      if (mod && keyMatchesLetter(e, KEY.A)) {
        e.preventDefault();
        const ids = reactFlowInstance.getNodes().map((n) => n.id);
        setSelectedNodeIds(new Set(ids));
        setSelectedNodeId(ids[0] ?? null);
        return true;
      }

      if (keyIsOneOf(e, [KEY.DELETE, KEY.BACKSPACE])) {
        e.preventDefault();
        const selected = getSelectedNodes(reactFlowInstance, selectedNodeId);
        if (selected.length > 0 || selectedEdgeId) {
          removeElements(
            selected.map((n) => n.id),
            selectedEdgeId ? [selectedEdgeId] : [],
          );
        }
        if (selected.length > 0) {
          setSelectedNodeId(null);
          setSelectedNodeIds(new Set());
        }
        if (selectedEdgeId) {
          setSelectedEdgeId(null);
        }
        return true;
      }

      return false;
    },
    [
      diagram,
      selectedNodeId,
      selectedEdgeId,
      reactFlowInstance,
      setSelectedNodeId,
      setSelectedNodeIds,
      setSelectedEdgeId,
      setContextMenu,
      clearClipboard,
      clearHighlight,
      removeElements,
      cancelInFlightGesture,
      onExitFlowPlayback,
      onExitFocusMode,
      onExitCompareMode,
    ],
  );
}
