import { useCallback } from "react";
import { isModKeyPressed, keyMatchesLetter, KEY, type KeyHandler } from "./helpers";

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

      if (e.shiftKey && keyMatchesLetter(e, KEY.Z)) {
        e.preventDefault();
        redo();
        return true;
      }

      if (keyMatchesLetter(e, KEY.Z)) {
        e.preventDefault();
        undo();
        return true;
      }

      return false;
    },
    [undo, redo],
  );
}
