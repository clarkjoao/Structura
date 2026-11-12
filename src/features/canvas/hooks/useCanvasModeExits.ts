import { useCallback } from "react";
import type { useDiagramActions } from "@/features/diagram";
import { useFlowMode } from "../flow/FlowModeContext";

/**
 * Escape's way out of a mode: leave a playing flow, or a version comparison.
 * Each returns false when its mode is not on, so the key falls through.
 */
export function useCanvasModeExits({
  isPlaying,
  isCompareMode,
  setCompareVersion,
}: {
  isPlaying: boolean;
  isCompareMode: boolean;
  setCompareVersion: ReturnType<typeof useDiagramActions>["setCompareVersion"];
}) {
  const flowMode = useFlowMode();
  const exitFlowPlayback = useCallback(() => {
    if (!isPlaying) return false;
    flowMode.exitPlay();
    return true;
  }, [isPlaying, flowMode]);
  const exitCompareMode = useCallback(() => {
    if (!isCompareMode) return false;
    setCompareVersion(null);
    return true;
  }, [isCompareMode, setCompareVersion]);
  return { exitFlowPlayback, exitCompareMode };
}
