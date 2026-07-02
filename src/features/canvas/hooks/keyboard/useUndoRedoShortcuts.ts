import { useCallback } from "react";
import { isModKeyPressed, keyMatchesLetter, KEY, type KeyHandler, getPlatform } from "./helpers";

interface UseUndoRedoShortcutsParams {
  undo: () => void;
  redo: () => void;
}

export function useUndoRedoShortcuts({ undo, redo }: UseUndoRedoShortcutsParams): KeyHandler {
  return useCallback(
    (e: KeyboardEvent): boolean => {
      const mod = isModKeyPressed(e);
      if (!mod) return false;

      // Windows and Linux use Y for redo
      if (getPlatform() !== "mac" && keyMatchesLetter(e, KEY.Y)) {
        e.preventDefault();
        redo();
        return true;
      }

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
