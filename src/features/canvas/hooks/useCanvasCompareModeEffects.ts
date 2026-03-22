import { useEffect, useRef } from "react";
import { toast } from "sonner";
import type { TFunction } from "i18next";

interface UseCanvasCompareModeEffectsParams {
  isCompareMode: boolean;
  isFlowPanelOpen: boolean;
  clearCanvasSelection: () => void;
  t: TFunction;
}

export function useCanvasCompareModeEffects(params: UseCanvasCompareModeEffectsParams): void {
  const { isCompareMode, isFlowPanelOpen, clearCanvasSelection, t } = params;

  const compareModeEnteredRef = useRef(false);
  useEffect(() => {
    if (!isCompareMode) {
      compareModeEnteredRef.current = false;
      return;
    }
    if (compareModeEnteredRef.current) return;
    compareModeEnteredRef.current = true;
    try {
      const k = "structura:compareTooltipSeen";
      if (typeof localStorage !== "undefined" && !localStorage.getItem(k)) {
        localStorage.setItem(k, "1");
        toast.message(t("scenes.compareModeTooltip"));
      }
    } catch {
      /* ignore */
    }
  }, [isCompareMode, t]);

  const prevCompareRef = useRef(false);
  useEffect(() => {
    if (isCompareMode && !prevCompareRef.current) {
      clearCanvasSelection();
    }
    prevCompareRef.current = isCompareMode;
  }, [isCompareMode, clearCanvasSelection]);

  useEffect(() => {
    if (isFlowPanelOpen) clearCanvasSelection();
  }, [isFlowPanelOpen]); // eslint-disable-line react-hooks/exhaustive-deps
}
