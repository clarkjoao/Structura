import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useLocation } from "react-router-dom";
import { ChevronLeft, ChevronRight, Play, Square, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFlowMode } from "@/features/canvas/flow/FlowModeContext";
import { useDiagramActions } from "@/features/diagram";
import { useWalkthrough, useWalkthroughSteps } from "../store/selectors/walkthroughs.selectors";
import { useWalkthroughPlayer } from "../hooks/useWalkthroughPlayer";

export function WalkthroughPlayerBar() {
  const { t } = useTranslation();
  const location = useLocation();
  const walkthroughPlayer = useWalkthroughPlayer();
  const flowMode = useFlowMode();
  const { openDiagram } = useDiagramActions();

  const handleExitWalkthrough = () => {
    walkthroughPlayer.exit();
    if (!flowMode.isIdle) {
      flowMode.exitPlay();
      flowMode.cancelRecording();
    }
  };

  const isWalkthroughEditorRoute = /^\/walkthroughs\/[^/]+\/edit$/.test(location.pathname);

  const walkthroughIdForHooks =
    walkthroughPlayer.mode.kind === "idle" ? "" : walkthroughPlayer.mode.walkthroughId;
  const walkthrough = useWalkthrough(walkthroughIdForHooks);
  const steps = useWalkthroughSteps(walkthroughIdForHooks);

  const stepIndexLabel = useMemo(() => {
    if (walkthroughPlayer.mode.kind !== "playing") return null;
    const selectedId = walkthroughPlayer.mode.selectedStepId;
    const index = steps.findIndex((step) => step.id === selectedId);
    const position = index === -1 ? 0 : index + 1;
    return t("walkthroughs.player.stepProgress", {
      current: position,
      total: steps.length,
    });
  }, [walkthroughPlayer.mode, steps, t]);

  const currentStepIndex = useMemo(() => {
    const mode = walkthroughPlayer.mode;
    if (mode.kind !== "playing") return -1;
    return steps.findIndex((step) => step.id === mode.selectedStepId);
  }, [walkthroughPlayer.mode, steps]);

  const hasNext = currentStepIndex >= 0 && currentStepIndex < steps.length - 1;
  const hasPrev = currentStepIndex > 0;

  const goNext = useCallback(() => {
    if (!hasNext) return;
    const next = steps[currentStepIndex + 1];
    if (!next) return;
    const walkthroughId =
      walkthroughPlayer.mode.kind === "playing" ? walkthroughPlayer.mode.walkthroughId : "";
    if (!flowMode.isIdle) {
      if (flowMode.isRecording) {
        flowMode.cancelRecording();
      } else {
        flowMode.exitPlay();
      }
    }
    walkthroughPlayer.setPlaybackContext(walkthroughId, next.id);
    walkthroughPlayer.selectStep(next.id);
    if (next.flowId && next.diagramId.length > 0) {
      walkthroughPlayer.startFlowPlayback(next.flowId, next.diagramId);
    } else if (next.diagramId.length > 0) {
      openDiagram(next.diagramId);
    }
  }, [currentStepIndex, flowMode, hasNext, walkthroughPlayer, openDiagram, steps]);

  const goPrev = useCallback(() => {
    if (!hasPrev) return;
    const prev = steps[currentStepIndex - 1];
    if (!prev) return;
    const walkthroughId =
      walkthroughPlayer.mode.kind === "playing" ? walkthroughPlayer.mode.walkthroughId : "";
    if (!flowMode.isIdle) {
      if (flowMode.isRecording) {
        flowMode.cancelRecording();
      } else {
        flowMode.exitPlay();
      }
    }
    walkthroughPlayer.setPlaybackContext(walkthroughId, prev.id);
    walkthroughPlayer.selectStep(prev.id);
    if (prev.flowId && prev.diagramId.length > 0) {
      walkthroughPlayer.startFlowPlayback(prev.flowId, prev.diagramId);
    } else if (prev.diagramId.length > 0) {
      openDiagram(prev.diagramId);
    }
  }, [currentStepIndex, flowMode, hasPrev, walkthroughPlayer, openDiagram, steps]);

  if (walkthroughPlayer.mode.kind === "idle") {
    return null;
  }

  if (isWalkthroughEditorRoute) {
    return null;
  }

  if (walkthroughPlayer.mode.kind === "playing") {
    return (
      <div className="fixed left-0 right-0 top-16 z-50 flex h-10 items-center justify-between border-b border-border bg-card/95 px-3 text-sm shadow-sm backdrop-blur-sm">
        <div className="flex min-w-0 items-center gap-2 text-foreground">
          <Play className="h-4 w-4 shrink-0 text-primary" />
          <span className="truncate font-medium">
            {walkthrough?.name ?? walkthroughPlayer.mode.walkthroughId}
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
            aria-label={t("walkthroughs.editor.prevStep")}
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
            aria-label={t("walkthroughs.editor.nextStep")}
          >
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            aria-label={t("walkthroughs.player.exit")}
            onClick={handleExitWalkthrough}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  const recordingMode = walkthroughPlayer.mode;
  const stepLabel =
    walkthrough?.steps[recordingMode.targetStepId]?.label ?? recordingMode.targetStepId;

  return (
    <div className="fixed left-0 right-0 top-16 z-50 flex h-10 items-center justify-between border-b border-border bg-card/95 px-3 text-sm shadow-sm backdrop-blur-sm">
      <div className="flex min-w-0 items-center gap-2 text-foreground">
        <span className="text-destructive" aria-hidden>
          ●
        </span>
        <span className="truncate">
          {t("walkthroughs.player.recordingLabel", { label: stepLabel })}
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          className="h-8 gap-1"
          onClick={() => walkthroughPlayer.finalizeWalkthroughRecording()}
        >
          <Square className="h-3.5 w-3.5 fill-current" />
          {t("walkthroughs.player.finalizeRecording")}
        </Button>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-8"
          onClick={handleExitWalkthrough}
        >
          {t("walkthroughs.player.cancelRecording")}
        </Button>
      </div>
    </div>
  );
}
