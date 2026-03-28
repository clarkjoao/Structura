import { useCallback } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import { useDiagramStore, type Diagram } from "@/features/diagram";
import {
  isModKeyPressed,
  getSelectedNodes,
  getCopyableIds,
  getPasteCenter,
  getCenterOfNodes,
  getOffsetPositionOfNodes,
  type KeyHandler,
} from "./helpers";
import { writeDrawioToClipboard } from "@/lib/clipboard-utils";

interface UseCopyPasteShortcutsParams {
  diagram: Diagram | null | undefined;
  selectedNodeId: string | null;
  reactFlowInstance: ReactFlowInstance;
  reactFlowWrapperRef: React.RefObject<HTMLDivElement | null>;
  copyToClipboard: (ids: string[]) => void;
  pasteFromClipboard: (position?: { x: number; y: number }) => string[];
  exportDrawioXml: (componentIds: string[]) => string;
  setSelectedNodeIds: (ids: Set<string>) => void;
}

/**
 * Cmd+C — copy selected
 * Cmd+V — paste offset from copied component positions (or viewport center if no clipboard / anchor)
 * Cmd+D — duplicate (copy + paste with offset)
 */
export function useCopyPasteShortcuts({
  diagram,
  selectedNodeId,
  reactFlowInstance,
  reactFlowWrapperRef,
  copyToClipboard,
  pasteFromClipboard,
  exportDrawioXml,
  setSelectedNodeIds,
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
        if (ids.length > 0) {
          // 1. Write to Zustand clipboard (for canvas paste via Cmd+V)
          copyToClipboard(ids);
          // 2. Write drawio XML of selected nodes to system clipboard
          const xml = exportDrawioXml(ids);
          void writeDrawioToClipboard(xml);
        }
        return true;
      }

      // Cmd/Ctrl+V — anchor paste position from Zustand clipboard ids, not current selection
      if (e.key === "v") {
        e.preventDefault();
        const clipboardIds =
          useDiagramStore.getState().clipboard?.components.map((component) => component.id) ??
          [];

        const offsetPos =
          diagram && clipboardIds.length > 0
            ? getOffsetPositionOfNodes(diagram, clipboardIds)
            : null;

        const pastePos =
          offsetPos ?? getPasteCenter(reactFlowInstance, reactFlowWrapperRef);
        const newIds = pasteFromClipboard(pastePos);
        if (newIds.length > 0) {
          reactFlowInstance.setNodes((nodes) =>
            nodes.map((node) => ({ ...node, selected: newIds.includes(node.id) })),
          );
          setSelectedNodeIds(new Set(newIds));
        }
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
        const newIds = pasteFromClipboard(center);
        if (newIds.length > 0) {
          reactFlowInstance.setNodes((nodes) =>
            nodes.map((node) => ({ ...node, selected: newIds.includes(node.id) })),
          );
          setSelectedNodeIds(new Set(newIds));
        }
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
      exportDrawioXml,
      setSelectedNodeIds,
    ],
  );
}
