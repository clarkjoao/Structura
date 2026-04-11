import { useCallback } from "react";
import { useFlowMode } from "../../flow/FlowModeContext";
import type { KeyHandler } from "./helpers";

export function useRecordingShortcuts(): KeyHandler {
  const { isRecording, onRecordUndo } = useFlowMode();

  return useCallback(
    (e: KeyboardEvent): boolean => {
      if (!isRecording) return false;
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        onRecordUndo?.();
      }
      return true; 
    },
    [isRecording, onRecordUndo],
  );
}
