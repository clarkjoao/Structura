import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ArrowRight, Check, Link2, Mic, Play, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFlowMode } from "@/features/canvas/flow";
import { useDiagramActions, useDiagrams } from "@/features/diagram";
import { useWalkthroughPlayer } from "../../hooks/useWalkthroughPlayer";
import {
  useWalkthrough,
  useWalkthroughActions,
  useWalkthroughSteps,
} from "../../store/selectors/walkthroughs.selectors";
import { StepFlowPickerDialog } from "./StepFlowPickerDialog";

export interface StepFlowSectionProps {
  walkthroughId: string;
  stepId: string;

  onSelectStep: (stepId: string) => void;

  onNextStep?: () => void;

  onPrevStep?: () => void;

  onLastStepFlowCompleted?: () => void;

  onWalkthroughComplete?: () => void;
}

export function StepFlowSection({
  walkthroughId,
  stepId,
  onSelectStep,
  onNextStep,
  onPrevStep,
  onLastStepFlowCompleted,
  onWalkthroughComplete,
}: StepFlowSectionProps) {
  const { t } = useTranslation();
  const flowMode = useFlowMode();
  const { openDiagram } = useDiagramActions();
  const walkthroughPlayer = useWalkthroughPlayer();
  const walkthrough = useWalkthrough(walkthroughId);
  const step = walkthrough?.steps[stepId];
  const diagramsRecord = useDiagrams();
  const diagram = step?.diagramId ? diagramsRecord[step.diagramId] : undefined;

  const { updateWalkthroughStep } = useWalkthroughActions();
  const sortedSteps = useWalkthroughSteps(walkthroughId);
  const currentStepIndex = sortedSteps.findIndex((item) => item.id === stepId);

  const [flowPickerOpen, setFlowPickerOpen] = useState(false);
  const [flowJustEnded, setFlowJustEnded] = useState(false);
  const prevIsPlaying = useRef(false);

  useEffect(() => {
    setFlowJustEnded(false);
    prevIsPlaying.current = false;
  }, [stepId]);

  useEffect(() => {
    const isPlaying = flowMode.isPlaying;
    if (isPlaying) {
      setFlowJustEnded(false);
    }
    if (prevIsPlaying.current && !isPlaying) {
      setFlowJustEnded(true);
      const isLastStep = currentStepIndex >= 0 && currentStepIndex === sortedSteps.length - 1;
      if (isLastStep) {
        onLastStepFlowCompleted?.();
      }
    }
    prevIsPlaying.current = isPlaying;
  }, [currentStepIndex, flowMode.isPlaying, onLastStepFlowCompleted, sortedSteps.length]);

  const flowName = step?.flowId && diagram ? diagram.snapshot.flows[step.flowId]?.name : undefined;

  const flowForStep = step?.flowId && diagram ? diagram.snapshot.flows[step.flowId] : undefined;

  const canPlayFlow = flowMode.isIdle;

  const walkthroughAndFlowIdle = flowMode.isIdle && walkthroughPlayer.mode.kind === "idle";

  const isRecordingThisStep =
    walkthroughPlayer.mode.kind === "recording" &&
    walkthroughPlayer.mode.walkthroughId === walkthroughId &&
    walkthroughPlayer.mode.targetStepId === stepId;

  const activePlayingFlow = flowMode.mode.kind === "playing" ? flowMode.mode.flow : null;
  const isPlayingThisStep =
    flowMode.isPlaying && !!step?.flowId && activePlayingFlow?.id === step?.flowId;

  const handleRecordNewFlow = () => {
    if (!step?.diagramId) return;
    if (!walkthroughAndFlowIdle) {
      toast.error(t("flows.alreadyActive"));
      return;
    }
    if (
      step.flowId &&
      typeof window !== "undefined" &&
      !window.confirm(t("walkthroughs.editor.replaceFlowConfirm"))
    ) {
      return;
    }
    walkthroughPlayer.startRecording(walkthroughId, stepId);
  };

  const handlePlayFlow = () => {
    if (!flowForStep || !step?.diagramId) return;
    if (!canPlayFlow) {
      toast.error(t("flows.alreadyActive"));
      return;
    }
    walkthroughPlayer.startFlowPlayback(flowForStep.id, step.diagramId);
  };

  const handleStopPlay = () => {
    flowMode.exitPlay();
  };

  const hasNextFromList = currentStepIndex >= 0 && currentStepIndex < sortedSteps.length - 1;
  const nextStepRecord = hasNextFromList ? sortedSteps[currentStepIndex + 1]! : null;

  if (!walkthrough || !step) {
    return (
      <p className="text-sm text-muted-foreground">{t("walkthroughs.editor.selectStepForFlow")}</p>
    );
  }

  return (
    <>
      <div className="grid gap-2 rounded-md border border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground">
            {t("walkthroughs.step.flowSection")}
          </span>
          {isRecordingThisStep ? (
            <span
              className="text-destructive"
              aria-hidden
              title={t("walkthroughs.editor.recording")}
            >
              ●
            </span>
          ) : null}
          {isPlayingThisStep ? (
            <Play className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          ) : null}
        </div>

        {diagram?.name ? <p className="text-xs text-muted-foreground">{diagram.name}</p> : null}

        {isRecordingThisStep ? (
          <>
            <p className="text-sm text-muted-foreground">{t("walkthroughs.editor.recording")}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1"
                onClick={() => walkthroughPlayer.finalizeWalkthroughRecording()}
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                {t("walkthroughs.editor.finishRecording")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => walkthroughPlayer.cancelWalkthroughRecording()}
              >
                <X className="h-3.5 w-3.5" />
                {t("walkthroughs.editor.cancelRecording")}
              </Button>
            </div>
          </>
        ) : null}

        {!isRecordingThisStep && isPlayingThisStep ? (
          <>
            <p className="text-sm text-foreground">{flowName ?? step.flowId}</p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-fit gap-1"
              onClick={handleStopPlay}
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              {t("walkthroughs.editor.stopPlay")}
            </Button>
          </>
        ) : null}

        {!isRecordingThisStep && !isPlayingThisStep && step.flowId ? (
          <>
            <p className="text-sm text-foreground">{flowName ?? step.flowId}</p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1"
                onClick={handlePlayFlow}
                disabled={!flowForStep}
              >
                <Play className="h-3.5 w-3.5" />
                {t("walkthroughs.step.playFlow")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => updateWalkthroughStep(walkthroughId, stepId, { flowId: undefined })}
              >
                {t("walkthroughs.step.unlinkFlow")}
              </Button>
            </div>
          </>
        ) : null}

        {!isRecordingThisStep && !isPlayingThisStep && !step.flowId ? (
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => setFlowPickerOpen(true)}
              disabled={!step.diagramId}
            >
              <Link2 className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t("walkthroughs.step.linkFlow")}
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={handleRecordNewFlow}
              disabled={!step.diagramId}
            >
              <Mic className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {t("walkthroughs.editor.recordNewFlow")}
            </Button>
          </div>
        ) : null}
      </div>

      {flowJustEnded && step.flowId ? (
        <div className="mt-3 grid gap-3 rounded-md border border-border p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            {t("walkthroughs.editor.flowCompleted")}
          </div>

          <div className="flex flex-col gap-2">
            {onPrevStep ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2"
                onClick={onPrevStep}
              >
                <ArrowLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {t("walkthroughs.editor.prevStep")}
              </Button>
            ) : null}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full justify-start gap-2"
              onClick={() => {
                const canAdvanceToNext =
                  Boolean(nextStepRecord) || Boolean(onNextStep && hasNextFromList);

                setFlowJustEnded(false);

                if (!canAdvanceToNext) {
                  onWalkthroughComplete?.();
                  return;
                }

                if (onNextStep) {
                  onNextStep();
                  return;
                }

                if (!nextStepRecord) {
                  return;
                }

                if (!flowMode.isIdle) {
                  if (flowMode.isRecording) {
                    flowMode.cancelRecording();
                  } else {
                    flowMode.exitPlay();
                  }
                }

                walkthroughPlayer.setPlaybackContext(walkthroughId, nextStepRecord.id);
                onSelectStep(nextStepRecord.id);

                if (nextStepRecord.flowId && nextStepRecord.diagramId.length > 0) {
                  walkthroughPlayer.startFlowPlayback(
                    nextStepRecord.flowId,
                    nextStepRecord.diagramId,
                  );
                } else if (nextStepRecord.diagramId.length > 0) {
                  openDiagram(nextStepRecord.diagramId);
                }
              }}
            >
              {nextStepRecord || (onNextStep && hasNextFromList) ? (
                <>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t("walkthroughs.editor.nextStep")}
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t("walkthroughs.editor.walkthroughCompleted")}
                </>
              )}
            </Button>
          </div>
        </div>
      ) : null}

      <StepFlowPickerDialog
        open={flowPickerOpen}
        onOpenChange={setFlowPickerOpen}
        diagramId={step.diagramId ?? null}
        onSelectFlow={(flowId) => {
          updateWalkthroughStep(walkthroughId, stepId, { flowId });
        }}
      />
    </>
  );
}
