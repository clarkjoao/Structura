import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { ReactFlowInstance } from "@xyflow/react";
import { toast } from "sonner";
import type { Diagram, DiagramModel } from "@/features/diagram";
import {
  isDiagramCompareMode,
  isPanelComponent,
  isReactFlowParentPanelType,
} from "@/features/diagram";
import type { ResolvedSnapshot } from "@/features/diagram";
import {
  getSelectedNodes,
  isModKeyPressed,
  KEY,
  keyMatchesLetter,
  type KeyHandler,
} from "./helpers";
import { getNodeType } from "../../utils/node-type-utils";

interface UseGroupShortcutsParams {
  diagram: Diagram | DiagramModel | null | undefined;
  reactFlowInstance: ReactFlowInstance;
  selectedNodeId: string | null;
  groupNodes: (ids: string[]) => string | null;
  ungroupNodes: (panelId: string) => void;
  setParent: (childId: string, parentId: string | null) => void;
  updateNodeLayout: (
    elementId: string,
    position: { x: number; y: number },
    dimensions?: { width: number; height: number },
  ) => void;
  resolvedSnapshot: ResolvedSnapshot | null;
}

export function useGroupShortcuts({
  diagram,
  reactFlowInstance,
  selectedNodeId,
  groupNodes,
  ungroupNodes,
  setParent,
  updateNodeLayout,
  resolvedSnapshot,
}: UseGroupShortcutsParams): KeyHandler {
  const { t } = useTranslation();

  return useCallback(
    (e: KeyboardEvent): boolean => {
      const mod = isModKeyPressed(e);
      if (!mod) return false;
      if (!keyMatchesLetter(e, KEY.G)) return false;

      e.preventDefault();

      if (e.shiftKey) {
        const selected = getSelectedNodes(reactFlowInstance, selectedNodeId);
        if (selected.length === 1 && resolvedSnapshot) {
          const node = selected[0];
          if (isReactFlowParentPanelType(getNodeType(node))) {
            ungroupNodes(node.id);
          } else {
            const comp = resolvedSnapshot.components[node.id];
            const parentComp = comp?.parentId ? resolvedSnapshot.components[comp.parentId] : undefined;
            if (comp?.parentId && parentComp && isPanelComponent(parentComp)) {
              const parentLayout = resolvedSnapshot.nodeLayouts[comp.parentId];
              const childLayout = resolvedSnapshot.nodeLayouts[node.id];
              if (parentLayout && childLayout) {
                setParent(node.id, null);
                updateNodeLayout(node.id, {
                  x: childLayout.x + parentLayout.x,
                  y: childLayout.y + parentLayout.y,
                });
              }
            }
          }
        }
        return true;
      }

      if (
        diagram &&
        ((diagram.activeSceneId && diagram.scenes?.[diagram.activeSceneId]) ||
          isDiagramCompareMode(diagram))
      ) {
        toast.error(t("scenes.groupBlockedInScene"));
        return true;
      }

      const selected = reactFlowInstance.getNodes().filter((n) => n.selected);
      if (selected.length >= 2) {
        groupNodes(selected.map((n) => n.id));
      }
      return true;
    },
    [
      diagram,
      reactFlowInstance,
      selectedNodeId,
      groupNodes,
      ungroupNodes,
      setParent,
      updateNodeLayout,
      resolvedSnapshot,
      t,
    ],
  );
}
