import { useCallback } from "react";
import { useFlowMode } from "../../flow/FlowModeContext";
import type { KeyHandler } from "./helpers";

/**
 * In recording mode, only Backspace/Delete triggers undo.
 * Returns a handler that consumes ALL events when recording (blocking other shortcuts).
 */
export function useRecordingShortcuts(): KeyHandler {
  const { isRecording, onRecordUndo } = useFlowMode();

  return useCallback(
    (e: KeyboardEvent): boolean => {
      if (!isRecording) return false;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onRecordUndo?.();
      }
      return true; // Block all other shortcuts during recording
    },
    [isRecording, onRecordUndo],
  );
}
