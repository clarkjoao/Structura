import { useCallback, type ComponentProps } from "react";
import { useCollab } from "@/features/collaboration";
import {
  getCachedCanvasSnapshot,
  useDiagramStore,
  type Diagram,
  type DiagramDirection,
  type DiagramLayoutSettings,
  type DiagramModel,
} from "@/features/diagram";
import type { CanvasBottomToolbar } from "../catalog/CanvasBottomToolbar";
import { useAutoArrange } from "../hooks/useAutoArrange";
import { useDiagramKindWatcher } from "../hooks/useDiagramKindWatcher";
import { interactionOf, resolveKindPolicy } from "@/features/diagram-kinds/policy";
import type { useCanvasController } from "../hooks/useCanvasController";
import { isArrangeBlockedInSession } from "../layout/sessionArrangeGuard";

type Controller = ReturnType<typeof useCanvasController>;
type ArrangeControl = ComponentProps<typeof CanvasBottomToolbar>["arrange"];

interface UseCanvasArrangeControlParams extends Pick<
  Controller,
  | "arrange"
  | "placeTouched"
  | "arrangeLabelled"
  | "isAutoLayoutRunning"
  | "handleAutoLayout"
  | "handleArrangeWithSettings"
> {
  diagram: Diagram | DiagramModel | null | undefined;
  /** Structural edits are allowed: the automatic mode places what an edit touched only then. */
  canEditStructure: boolean;
}

/**
 * Arrange on the editor canvas: runs the automatic mode while structure can be
 * edited, and builds the Arrange menu's props for the bottom toolbar (null
 * without a diagram).
 */
export function useCanvasArrangeControl({
  diagram,
  canEditStructure,
  arrange,
  placeTouched,
  arrangeLabelled,
  isAutoLayoutRunning,
  handleAutoLayout,
  handleArrangeWithSettings,
}: UseCanvasArrangeControlParams): ArrangeControl | null {
  const placeAutomatically = useCallback(
    (dirtyIds: string[]) => placeTouched(dirtyIds, arrangeLabelled),
    [placeTouched, arrangeLabelled],
  );
  // A kind that arranges its diagram replaces the automatic mode there (ADR-0014).
  const interaction = interactionOf(resolveKindPolicy(diagram));
  const kindArranges = !interaction.arrangeModeChoice;
  useAutoArrange({ enabled: canEditStructure && !kindArranges, arrange: placeAutomatically });
  useDiagramKindWatcher({ enabled: canEditStructure });
  const { session: collabSession } = useCollab();
  const switchDirection = useCallback(
    (direction: DiagramDirection) => void arrange({ direction }),
    [arrange],
  );
  const saveLayoutSettings = useCallback(
    (settings: DiagramLayoutSettings) => useDiagramStore.getState().setLayoutSettings(settings),
    [],
  );

  if (!diagram) return null;
  return {
    settings: diagram.layoutSettings,
    labelled: arrangeLabelled,
    running: isAutoLayoutRunning,
    onArrange: handleAutoLayout,
    onSettingsChange: handleArrangeWithSettings,
    onSettingsSave: saveLayoutSettings,
    direction: diagram.direction ?? "LR",
    onDirectionChange: switchDirection,
    directionLockedReasonKey: collabSession ? "canvasToolbar.arrange.directionLockedSession" : null,
    modeChoice: interaction.arrangeModeChoice,
    arrangeLockedReasonKey: isArrangeBlockedInSession(
      getCachedCanvasSnapshot(diagram).components,
      collabSession !== null,
    )
      ? "canvasToolbar.arrange.lockedLargeSession"
      : null,
  };
}
