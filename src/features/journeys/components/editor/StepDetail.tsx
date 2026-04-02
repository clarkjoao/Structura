import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import debounce from "lodash.debounce";
import { Link2, Mic, Play, Square, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFlowMode } from "@/features/canvas/flow";
import { getCachedCanvasSnapshot, useDiagrams } from "@/features/diagram";
import { useJourneyPlayer } from "../../player/useJourneyPlayer";
import { useJourney, useJourneyActions } from "../../selectors";
import type { JourneyStep } from "../../types";
import { AddStepModal } from "./AddStepModal";
import { StepFlowPickerDialog } from "./StepFlowPickerDialog";

const FIELD_DEBOUNCE_MS = 300;

interface StepDetailProps {
  journeyId: string;
  stepId: string;
}

export function StepDetail({ journeyId, stepId }: StepDetailProps) {
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

  const [label, setLabel] = useState("");
  const [description, setDescription] = useState("");
  const [duration, setDuration] = useState("");
  const [replaceOpen, setReplaceOpen] = useState(false);
  const [flowPickerOpen, setFlowPickerOpen] = useState(false);

  useEffect(() => {
    if (!step) return;
    setLabel(step.label);
    setDescription(step.description ?? "");
    setDuration(step.duration ?? "");
  }, [step]);

  const debouncedPatch = useMemo(
    () =>
      debounce((patch: Partial<Omit<JourneyStep, "id">>) => {
        updateJourneyStep(journeyId, stepId, patch);
      }, FIELD_DEBOUNCE_MS),
    [journeyId, stepId, updateJourneyStep],
  );

  useEffect(() => () => debouncedPatch.cancel(), [debouncedPatch]);

  const snapshot =
    step?.diagramId && diagram ? getCachedCanvasSnapshot(diagram) : null;
  const componentName =
    step?.componentId && snapshot
      ? snapshot.components[step.componentId]?.name
      : undefined;
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

  if (!journey || !step) {
    return (
      <div className="border-t border-border p-3 text-xs text-muted-foreground">
        {t("journeys.editor.selectStepForVisual")}
      </div>
    );
  }

  return (
    <div className="flex max-h-[42vh] shrink-0 flex-col gap-3 overflow-y-auto border-t border-border bg-card p-3">
      <div className="grid gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          {t("journeys.step.label")}
        </label>
        <Input
          value={label}
          onChange={(event) => {
            const value = event.target.value;
            setLabel(value);
            debouncedPatch({ label: value });
          }}
        />
      </div>

      <div className="grid gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          {t("journeys.step.description")}
        </label>
        <textarea
          value={description}
          onChange={(event) => {
            const value = event.target.value;
            setDescription(value);
            debouncedPatch({ description: value || undefined });
          }}
          rows={3}
          className="w-full resize-none rounded-md border border-border bg-secondary px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-ring"
        />
      </div>

      <div className="grid gap-2">
        <label className="text-xs font-medium text-muted-foreground">
          {t("journeys.step.duration")}
        </label>
        <Input
          value={duration}
          placeholder={t("journeys.step.durationPlaceholder")}
          onChange={(event) => {
            const value = event.target.value;
            setDuration(value);
            debouncedPatch({ duration: value || undefined });
          }}
        />
      </div>

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

      {step.diagramId || step.componentId ? (
        <div className="grid gap-2 rounded-md border border-border p-3">
          <span className="text-xs font-semibold text-foreground">
            {t("journeys.step.reference")}
          </span>
          <p className="text-sm text-muted-foreground">
            {step.diagramId ? (
              <>
                {diagram?.name ?? step.diagramId}
                {step.componentId ? (
                  <>
                    <span className="text-muted-foreground/80"> · </span>
                    {componentName ?? step.componentId}
                  </>
                ) : null}
              </>
            ) : (
              <>{componentName ?? step.componentId}</>
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="w-fit"
            onClick={() => setReplaceOpen(true)}
          >
            {t("journeys.step.changeElement")}
          </Button>
        </div>
      ) : null}

      <AddStepModal
        open={replaceOpen}
        onOpenChange={setReplaceOpen}
        journeyId={journeyId}
        onConfirm={(next) => {
          updateJourneyStep(journeyId, stepId, {
            label: next.label,
            description: next.description,
            diagramId: next.diagramId,
            componentId: undefined,
            flowId: undefined,
          });
          setReplaceOpen(false);
        }}
      />

      <StepFlowPickerDialog
        open={flowPickerOpen}
        onOpenChange={setFlowPickerOpen}
        diagramId={step.diagramId ?? null}
        onSelectFlow={(flowId) => {
          updateJourneyStep(journeyId, stepId, { flowId });
        }}
      />
    </div>
  );
}
