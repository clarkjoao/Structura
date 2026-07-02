import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import type { ReactFlowInstance } from "@xyflow/react";
import type { Diagram, DiagramModel } from "@/features/diagram";
import { getCachedCanvasSnapshot } from "@/features/diagram";
import {
  getSelectedNodes,
  isModKeyPressed,
  KEY,
  keyMatchesLetter,
  type KeyHandler,
} from "./helpers";

interface UseLockShortcutsParams {
  diagram: Diagram | DiagramModel | null | undefined;
  reactFlowInstance: ReactFlowInstance;
  selectedNodeId: string | null;
  updateComponent: (id: string, patch: { locked?: boolean }) => void;
}

export function useLockShortcuts({
  diagram,
  reactFlowInstance,
  selectedNodeId,
  updateComponent,
}: UseLockShortcutsParams): KeyHandler {
  const { t } = useTranslation();

  return useCallback(
    (e: KeyboardEvent): boolean => {
      if (!diagram) return false;
      const mod = isModKeyPressed(e);

      if (mod && e.shiftKey && keyMatchesLetter(e, KEY.K)) {
        e.preventDefault();
        const selected = getSelectedNodes(reactFlowInstance, selectedNodeId);
        if (selected.length === 0) return true;

        const snapshot = getCachedCanvasSnapshot(diagram);
        const components = selected.map((n) => snapshot.components[n.id]).filter(Boolean);

        if (components.length === 0) return true;

        const allLocked = components.every((c) => c.locked);
        const nextLocked = !allLocked;

        for (const c of components) {
          updateComponent(c.id, { locked: nextLocked });
        }

        toast.success(nextLocked ? t("canvas.elementsLocked") : t("canvas.elementsUnlocked"));
        return true;
      }

      return false;
    },
    [diagram, reactFlowInstance, selectedNodeId, updateComponent, t],
  );
}
