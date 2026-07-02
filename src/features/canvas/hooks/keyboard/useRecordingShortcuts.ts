import { useCallback } from "react";
import { useFlowMode } from "../../flow/FlowModeContext";
import { KEY, keyIsOneOf, type KeyHandler } from "./helpers";

export function useRecordingShortcuts(): KeyHandler {
  const { isRecording, onRecordUndo } = useFlowMode();

  return useCallback(
    (e: KeyboardEvent): boolean => {
      if (!isRecording) return false;
      if (keyIsOneOf(e, [KEY.DELETE, KEY.BACKSPACE])) {
        e.preventDefault();
        onRecordUndo?.();
      }
      return true;
    },
    [isRecording, onRecordUndo],
  );
}
