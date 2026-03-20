import { useCallback } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import { isReactFlowParentPanelType } from "@/features/diagram";
import { isModKeyPressed, type KeyHandler } from "./helpers";

interface UseGroupShortcutsParams {
  reactFlowInstance: ReactFlowInstance;
  groupNodes: (ids: string[]) => string | null;
  ungroupNodes: (panelId: string) => void;
}

/**
 * Cmd+G — group selected nodes into a panel
 * Cmd+Shift+G — ungroup panel
 */
export function useGroupShortcuts({
  reactFlowInstance,
  groupNodes,
  ungroupNodes,
}: UseGroupShortcutsParams): KeyHandler {
  return useCallback(
    (e: KeyboardEvent): boolean => {
      const mod = isModKeyPressed(e);
      if (!mod || e.key !== "g") return false;

      e.preventDefault();

      // Cmd/Ctrl+Shift+G — ungroup panel
      if (e.shiftKey) {
        const selected = reactFlowInstance.getNodes().filter((n) => n.selected);
        if (selected.length === 1 && isReactFlowParentPanelType(selected[0].type as string)) {
          ungroupNodes(selected[0].id);
        }
        return true;
      }

      // Cmd/Ctrl+G — group selected
      const selected = reactFlowInstance.getNodes().filter((n) => n.selected);
      if (selected.length >= 2) {
        groupNodes(selected.map((n) => n.id));
      }
      return true;
    },
    [reactFlowInstance, groupNodes, ungroupNodes],
  );
}
