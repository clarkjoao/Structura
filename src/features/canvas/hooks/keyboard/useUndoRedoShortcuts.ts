import { useCallback } from "react";
import { isModKeyPressed, type KeyHandler } from "./helpers";

interface UseUndoRedoShortcutsParams {
  undo: () => void;
  redo: () => void;
}

/**
 * Cmd+Z — undo
 * Cmd+Shift+Z — redo
 */
export function useUndoRedoShortcuts({
  undo,
  redo,
}: UseUndoRedoShortcutsParams): KeyHandler {
  return useCallback(
    (e: KeyboardEvent): boolean => {
      const mod = isModKeyPressed(e);
      if (!mod) return false;

      // Cmd/Ctrl+Shift+Z — redo
      if (e.shiftKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        redo();
        return true;
      }

      // Cmd/Ctrl+Z — undo
      if (e.key === "z") {
        e.preventDefault();
        undo();
        return true;
      }

      return false;
    },
    [undo, redo],
  );
}
