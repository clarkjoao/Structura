import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Link2,
  Mic,
  Play,
  Square,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useFlowMode } from "@/features/canvas/flow";
import { useDiagrams } from "@/features/diagram";
import { useJourneyPlayer } from "../../hooks/useJourneyPlayer";
import { useJourney, useJourneyActions, useJourneySteps } from "../../store/selectors/journeys.selectors";
import { StepFlowPickerDialog } from "./StepFlowPickerDialog";

export interface StepFlowSectionProps {
  journeyId: string;
  stepId: string;
  /** Used when a flow ends and global journey play is off — selects the next step. */
  onSelectStep: (stepId: string) => void;
  /** When set (e.g. global journey play), advances with playback. */
  onNextStep?: () => void;
  /** When set (e.g. global journey play), goes to previous step with playback. */
  onPrevStep?: () => void;
}

export function StepFlowSection({
  journeyId,
  stepId,
  onSelectStep,
  onNextStep,
  onPrevStep,
}: StepFlowSectionProps) {
  const { t } = useTranslation();
  const flowMode = useFlowMode();
  const journeyPlayer = useJourneyPlayer();
  const journey = useJourney(journeyId);
  const step = journey?.steps[stepId];
  const diagramsRecord = useDiagrams();
  const diagram = step?.diagramId
    ? diagramsRecord[step.diagramId]
    : undefined;

  const { updateJourneyStep } = useJourneyActions();
  const sortedSteps = useJourneySteps(journeyId);

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
    }
    prevIsPlaying.current = isPlaying;
  }, [flowMode.isPlaying]);

  const flowName =
    step?.flowId && diagram
      ? diagram.snapshot.flows[step.flowId]?.name
      : undefined;

  const flowForStep =
    step?.flowId && diagram
      ? diagram.snapshot.flows[step.flowId]
      : undefined;

  const journeyAndFlowIdle =
    flowMode.isIdle && journeyPlayer.mode.kind === "idle";

  const isRecordingThisStep =
    journeyPlayer.mode.kind === "recording" &&
    journeyPlayer.mode.journeyId === journeyId &&
    journeyPlayer.mode.targetStepId === stepId;

  const activePlayingFlow =
    flowMode.mode.kind === "playing" ? flowMode.mode.flow : null;
  const isPlayingThisStep =
    flowMode.isPlaying &&
    !!step?.flowId &&
    activePlayingFlow?.id === step?.flowId;

  const handleRecordNewFlow = () => {
    if (!step?.diagramId) return;
    if (!journeyAndFlowIdle) {
      toast.error(t("flows.alreadyActive"));
      return;
    }
    if (
      step.flowId &&
      typeof window !== "undefined" &&
      !window.confirm(t("journeys.editor.replaceFlowConfirm"))
    ) {
      return;
    }
    journeyPlayer.startRecording(journeyId, stepId);
  };

  const handlePlayFlow = () => {
    if (!flowForStep) return;
    if (!journeyAndFlowIdle) {
      toast.error(t("flows.alreadyActive"));
      return;
    }
    flowMode.play(flowForStep);
  };

  const handleStopPlay = () => {
    flowMode.exitPlay();
  };

  const currentStepIndex = sortedSteps.findIndex((item) => item.id === stepId);
  const hasNextFromList =
    currentStepIndex >= 0 && currentStepIndex < sortedSteps.length - 1;
  const nextStepRecord =
    hasNextFromList ? sortedSteps[currentStepIndex + 1]! : null;

  if (!journey || !step) {
    return (
      <p className="text-sm text-muted-foreground">
        {t("journeys.editor.selectStepForFlow")}
      </p>
    );
  }

  return (
    <>
      <div className="grid gap-2 rounded-md border border-border p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold text-foreground">
            {t("journeys.step.flowSection")}
          </span>
          {isRecordingThisStep ? (
            <span
              className="text-destructive"
              aria-hidden
              title={t("journeys.editor.recording")}
            >
              ●
            </span>
          ) : null}
          {isPlayingThisStep ? (
            <Play
              className="h-3.5 w-3.5 shrink-0 text-primary"
              aria-hidden
            />
          ) : null}
        </div>

        {diagram?.name ? (
          <p className="text-xs text-muted-foreground">{diagram.name}</p>
        ) : null}

        {isRecordingThisStep ? (
          <>
            <p className="text-sm text-muted-foreground">
              {t("journeys.editor.recording")}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="gap-1"
                onClick={() => journeyPlayer.finalizeJourneyRecording()}
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                {t("journeys.editor.finishRecording")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1"
                onClick={() => journeyPlayer.cancelJourneyRecording()}
              >
                <X className="h-3.5 w-3.5" />
                {t("journeys.editor.cancelRecording")}
              </Button>
            </div>
          </>
        ) : null}

        {!isRecordingThisStep && isPlayingThisStep ? (
          <>
            <p className="text-sm text-foreground">
              {flowName ?? step.flowId}
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-fit gap-1"
              onClick={handleStopPlay}
            >
              <Square className="h-3.5 w-3.5 fill-current" />
              {t("journeys.editor.stopPlay")}
            </Button>
          </>
        ) : null}

        {!isRecordingThisStep && !isPlayingThisStep && step.flowId ? (
          <>
            <p className="text-sm text-foreground">
              {flowName ?? step.flowId}
            </p>
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
                {t("journeys.step.playFlow")}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  updateJourneyStep(journeyId, stepId, { flowId: undefined })
                }
              >
                {t("journeys.step.unlinkFlow")}
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
              {t("journeys.step.linkFlow")}
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
              {t("journeys.editor.recordNewFlow")}
            </Button>
          </div>
        ) : null}
      </div>

      {flowJustEnded && step.flowId ? (
        <div className="mt-3 grid gap-3 rounded-md border border-border p-3">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden />
            {t("journeys.editor.flowCompleted")}
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
                {t("journeys.editor.prevStep")}
              </Button>
            ) : null}

            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="w-full justify-start gap-2"
              disabled={
                onNextStep ? !hasNextFromList : nextStepRecord === null
              }
              onClick={() => {
                if (onNextStep) {
                  onNextStep();
                } else if (nextStepRecord) {
                  onSelectStep(nextStepRecord.id);
                }
              }}
            >
              {nextStepRecord || (onNextStep && hasNextFromList) ? (
                <>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t("journeys.editor.nextStep")}
                </>
              ) : (
                <>
                  <Check className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  {t("journeys.editor.journeyCompleted")}
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
          updateJourneyStep(journeyId, stepId, { flowId });
        }}
      />
    </>
  );
}
