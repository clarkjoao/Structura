import { useCallback } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import type { Diagram } from "@/features/diagram";
import {
  isModKeyPressed,
  getSelectedNodes,
  getCopyableIds,
  getPasteCenter,
  getCenterOfNodes,
  type KeyHandler,
} from "./helpers";

interface UseCopyPasteShortcutsParams {
  diagram: Diagram | null | undefined;
  selectedNodeId: string | null;
  reactFlowInstance: ReactFlowInstance;
  reactFlowWrapperRef: React.RefObject<HTMLDivElement | null>;
  copyToClipboard: (ids: string[]) => void;
  pasteFromClipboard: (position?: { x: number; y: number }) => void;
}

/**
 * Cmd+C — copy selected
 * Cmd+V — paste at viewport center
 * Cmd+D — duplicate (copy + paste with offset)
 */
export function useCopyPasteShortcuts({
  diagram,
  selectedNodeId,
  reactFlowInstance,
  reactFlowWrapperRef,
  copyToClipboard,
  pasteFromClipboard,
}: UseCopyPasteShortcutsParams): KeyHandler {
  return useCallback(
    (e: KeyboardEvent): boolean => {
      if (!diagram) return false;
      const mod = isModKeyPressed(e);
      if (!mod) return false;

      // Cmd/Ctrl+C — copy
      if (e.key === "c") {
        e.preventDefault();
        const nodes = getSelectedNodes(reactFlowInstance, selectedNodeId);
        const ids = getCopyableIds(diagram, nodes);
        if (ids.length > 0) copyToClipboard(ids);
        return true;
      }

      // Cmd/Ctrl+V — paste at center
      if (e.key === "v") {
        e.preventDefault();
        const center = getPasteCenter(reactFlowInstance, reactFlowWrapperRef);
        pasteFromClipboard(center);
        return true;
      }

      // Cmd/Ctrl+D — duplicate
      if (e.key === "d") {
        e.preventDefault();
        const nodes = getSelectedNodes(reactFlowInstance, selectedNodeId);
        const ids = getCopyableIds(diagram, nodes);
        if (ids.length === 0) return true;
        copyToClipboard(ids);
        const center = getCenterOfNodes(diagram, ids);
        pasteFromClipboard(center);
        return true;
      }

      return false;
    },
    [
      diagram,
      selectedNodeId,
      reactFlowInstance,
      reactFlowWrapperRef,
      copyToClipboard,
      pasteFromClipboard,
    ],
  );
}
