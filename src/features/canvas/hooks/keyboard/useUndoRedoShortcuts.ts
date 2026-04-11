import { useCallback } from "react";
import { isModKeyPressed, type KeyHandler } from "./helpers";

interface UseUndoRedoShortcutsParams {
  undo: () => void;
  redo: () => void;
}

export function useUndoRedoShortcuts({
  undo,
  redo,
}: UseUndoRedoShortcutsParams): KeyHandler {
  return useCallback(
    (e: KeyboardEvent): boolean => {
      const mod = isModKeyPressed(e);
      if (!mod) return false;

      if (e.shiftKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        redo();
        return true;
      }

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
