import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight, Play, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFlowMode } from "@/features/canvas";
import { useDiagramActions } from "@/features/diagram";
import { useJourney, useJourneySteps } from "../store/selectors/journeys.selectors";
import { useJourneyPlayer } from "../hooks/useJourneyPlayer";

export function JourneyPlayerBar() {
  const { t } = useTranslation();
  const location = useLocation();
  const journeyPlayer = useJourneyPlayer();
  const flowMode = useFlowMode();
  const { openDiagram } = useDiagramActions();

  const handleExitJourney = () => {
    journeyPlayer.exit();
    if (!flowMode.isIdle) {
      flowMode.exitPlay();
      flowMode.cancelRecording();
    }
  };

  const isJourneyEditorRoute = /^\/journeys\/[^/]+\/edit$/.test(
    location.pathname,
  );

  const journeyIdForHooks =
    journeyPlayer.mode.kind === "idle" ? "" : journeyPlayer.mode.journeyId;
  const journey = useJourney(journeyIdForHooks);
  const steps = useJourneySteps(journeyIdForHooks);

  const stepIndexLabel = useMemo(() => {
    if (journeyPlayer.mode.kind !== "playing") return null;
    const selectedId = journeyPlayer.mode.selectedStepId;
    const index = steps.findIndex((step) => step.id === selectedId);
    const position = index === -1 ? 0 : index + 1;
    return t("journeys.player.stepProgress", {
      current: position,
      total: steps.length,
    });
  }, [journeyPlayer.mode, steps, t]);

  const currentStepIndex = useMemo(() => {
    const mode = journeyPlayer.mode;
    if (mode.kind !== "playing") return -1;
    return steps.findIndex((step) => step.id === mode.selectedStepId);
  }, [journeyPlayer.mode, steps]);

  const hasNext = currentStepIndex >= 0 && currentStepIndex < steps.length - 1;
  const hasPrev = currentStepIndex > 0;

  const goNext = useCallback(() => {
    if (!hasNext) return;
    const next = steps[currentStepIndex + 1];
    if (!next) return;
    const journeyId =
      journeyPlayer.mode.kind === "playing"
        ? journeyPlayer.mode.journeyId
        : "";
    if (!flowMode.isIdle) {
      if (flowMode.isRecording) {
        flowMode.cancelRecording();
      } else {
        flowMode.exitPlay();
      }
    }
    journeyPlayer.setPlaybackContext(journeyId, next.id);
    journeyPlayer.selectStep(next.id);
    if (next.flowId && next.diagramId.length > 0) {
      journeyPlayer.startFlowPlayback(next.flowId, next.diagramId);
    } else if (next.diagramId.length > 0) {
      openDiagram(next.diagramId);
    }
  }, [
    currentStepIndex,
    flowMode,
    hasNext,
    journeyPlayer,
    openDiagram,
    steps,
  ]);

  const goPrev = useCallback(() => {
    if (!hasPrev) return;
    const prev = steps[currentStepIndex - 1];
    if (!prev) return;
    const journeyId =
      journeyPlayer.mode.kind === "playing"
        ? journeyPlayer.mode.journeyId
        : "";
    if (!flowMode.isIdle) {
      if (flowMode.isRecording) {
        flowMode.cancelRecording();
      } else {
        flowMode.exitPlay();
      }
    }
    journeyPlayer.setPlaybackContext(journeyId, prev.id);
    journeyPlayer.selectStep(prev.id);
    if (prev.flowId && prev.diagramId.length > 0) {
      journeyPlayer.startFlowPlayback(prev.flowId, prev.diagramId);
    } else if (prev.diagramId.length > 0) {
      openDiagram(prev.diagramId);
    }
  }, [
    currentStepIndex,
    flowMode,
    hasPrev,
    journeyPlayer,
    openDiagram,
    steps,
  ]);

  if (journeyPlayer.mode.kind === "idle") {
    return null;
  }

  if (isJourneyEditorRoute) {
    return null;
  }

  if (journeyPlayer.mode.kind === "playing") {
    return (
      <div className="fixed left-0 right-0 top-16 z-50 flex h-10 items-center justify-between border-b border-border bg-card/95 px-3 text-sm shadow-sm backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2 text-foreground">
          <Play className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate font-medium">
            {journey?.name ?? journeyPlayer.mode.journeyId}
          </span>
          {stepIndexLabel ? (
            <span className="shrink-0 text-muted-foreground">{stepIndexLabel}</span>
          ) : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!hasPrev}
            onClick={goPrev}
            aria-label={t("journeys.editor.prevStep")}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={!hasNext}
            onClick={goNext}
            aria-label={t("journeys.editor.nextStep")}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label={t("journeys.player.exit")}
            onClick={handleExitJourney}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  const recordingMode = journeyPlayer.mode;
  const stepLabel =
    journey?.steps[recordingMode.targetStepId]?.label ??
    recordingMode.targetStepId;

  return (
    <div className="fixed left-0 right-0 top-16 z-50 flex h-10 items-center justify-between border-b border-border bg-card/95 px-3 text-sm shadow-sm backdrop-blur-sm">
      <div className="flex min-w-0 items-center gap-2 text-foreground">
        <span className="text-destructive" aria-hidden>
          ●
        </span>
        <span className="truncate">
          {t("journeys.player.recordingLabel", { label: stepLabel })}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 gap-1"
          onClick={() => journeyPlayer.finalizeJourneyRecording()}
        >
          <Square className="h-3.5 w-3.5 fill-current" />
          {t("journeys.player.finalizeRecording")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={handleExitJourney}
        >
          {t("journeys.player.cancelRecording")}
        </Button>
      </div>
    </div>
  );
}
