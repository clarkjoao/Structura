import type { TFunction } from "i18next";
import type { Diagram } from "@/features/diagram";
import { useCanvasCompareMode } from "./useCanvasCompareMode";
import { useCanvasCompareModeEffects } from "./useCanvasCompareModeEffects";

export interface UseCanvasCompareStateParams {
  diagram: Diagram | null | undefined;
  isFlowPanelOpen: boolean;
  clearCanvasSelection: () => void;
  t: TFunction;
}

export function useCanvasCompareState(params: UseCanvasCompareStateParams) {
  const { diagram, isFlowPanelOpen, clearCanvasSelection, t } = params;
  const compare = useCanvasCompareMode(diagram);

  useCanvasCompareModeEffects({
    isCompareMode: compare.isCompareMode,
    isFlowPanelOpen,
    clearCanvasSelection,
    t,
  });

  return compare;
}
