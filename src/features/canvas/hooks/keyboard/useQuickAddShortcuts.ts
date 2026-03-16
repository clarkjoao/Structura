import { useCallback } from "react";
import type { ReactFlowInstance } from "@xyflow/react";
import type { ComponentType, Component } from "@/features/diagram";
import { getViewportCenter } from "../../viewport-utils";
import { isModKeyPressed, type KeyHandler } from "./helpers";

const C4_SHORTCUT_MAP: Record<string, { type: ComponentType; name: string }> = {
  "1": { type: "person", name: "Novo Person" },
  "2": { type: "system", name: "Novo System" },
  "3": { type: "container", name: "Novo Container" },
  "4": { type: "component", name: "Novo Component" },
};

interface UseQuickAddShortcutsParams {
  reactFlowInstance: ReactFlowInstance;
  addComponent: (
    type: ComponentType,
    name: string,
    parentId: string | null,
    position?: { x: number; y: number },
    awsService?: string,
  ) => Component;
  isPanelOpen: boolean;
  onOpenSearch?: () => void;
}

/**
 * Cmd+1–4 — add C4 component at viewport center
 * Cmd+/ — open search
 */
export function useQuickAddShortcuts({
  reactFlowInstance,
  addComponent,
  isPanelOpen,
  onOpenSearch,
}: UseQuickAddShortcutsParams): KeyHandler {
  return useCallback(
    (e: KeyboardEvent): boolean => {
      const mod = isModKeyPressed(e);
      if (!mod) return false;

      // Cmd/Ctrl+/ — open search
      if (e.key === "/") {
        e.preventDefault();
        onOpenSearch?.();
        return true;
      }

      // Cmd/Ctrl+1–4 — add C4 component
      if (C4_SHORTCUT_MAP[e.key]) {
        e.preventDefault();
        const { type, name } = C4_SHORTCUT_MAP[e.key];
        const pos = getViewportCenter(reactFlowInstance, isPanelOpen);
        addComponent(type, name, null, pos);
        return true;
      }

      return false;
    },
    [reactFlowInstance, addComponent, isPanelOpen, onOpenSearch],
  );
}
