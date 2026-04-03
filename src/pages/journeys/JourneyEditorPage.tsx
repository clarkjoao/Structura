import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Play, Square } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useFlowMode } from "@/features/canvas";
import { useAllDiagrams } from "@/features/diagram";
import {
  JourneyEditorCanvas,
  RightPanel,
  StepDetail,
  StepFlowSection,
  StepList,
  useJourney,
  useJourneyActions,
  useJourneyGlobalPlayer,
  useJourneyPlayer,
  useJourneySteps,
} from "@/features/journeys";

export default function JourneyEditorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const journeyId = params.id ?? "";
  const journey = useJourney(journeyId);
  const steps = useJourneySteps(journeyId);
  const allDiagrams = useAllDiagrams();
  const { updateJourney } = useJourneyActions();
  const flowMode = useFlowMode();
  const journeyPlayer = useJourneyPlayer();
  const {
    setPlaybackContext,
    selectStep: journeySelectStep,
    mode: journeyPlayerMode,
    cancelJourneyRecording,
  } = journeyPlayer;

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const journeyKey = journey?.id ?? "";

  useEffect(() => {
    if (!journey) return;
    setSelectedStepId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when switching journey
  }, [journeyKey]);

  useEffect(() => {
    if (steps.length === 0) {
      setSelectedStepId(null);
    }
  }, [steps.length]);

  useEffect(() => {
    if (!selectedStepId) return;
    if (!journey?.steps[selectedStepId]) {
      setSelectedStepId(null);
    }
  }, [selectedStepId, journey?.steps]);

  useEffect(() => {
    if (!journey) return;
    setNameDraft(journey.name);
  }, [journey]);

  useEffect(() => {
    const id = journey?.id;
    if (!id) return;
    setPlaybackContext(id, selectedStepId);
  }, [journey?.id, selectedStepId, setPlaybackContext]);

  const handleSelectStep = useCallback(
    (stepId: string, options?: { preserveFlowPlayback?: boolean }) => {
      setSelectedStepId(stepId);
      if (journeyPlayerMode.kind === "playing") {
        journeySelectStep(stepId);
      }
      if (options?.preserveFlowPlayback) {
        return;
      }
      if (flowMode.isPlaying) {
        flowMode.exitPlay();
      }
      if (journeyPlayerMode.kind === "recording") {
        cancelJourneyRecording();
      } else if (flowMode.isRecording) {
        flowMode.cancelRecording();
      }
    },
    [
      cancelJourneyRecording,
      flowMode,
      journeyPlayerMode.kind,
      journeySelectStep,
    ],
  );

  const {
    isGlobalPlaying,
    startGlobalPlay,
    stopGlobalPlay,
    goToNextStep,
    goToPrevStep,
    hasNextStep,
    hasPrevStep,
    isLastStep,
  } = useJourneyGlobalPlayer({
    journeyId,
    selectedStepId,
    onSelectStep: handleSelectStep,
  });

  const selectedStep =
    journey && selectedStepId ? journey.steps[selectedStepId] : null;

  const activeDiagramId = useMemo(() => {
    if (selectedStep?.diagramId) return selectedStep.diagramId;
    if (!journey) return null;
    const ordered = Object.values(journey.steps).sort(
      (left, right) => left.order - right.order,
    );
    const fromSteps = ordered.find((step) => step.diagramId)?.diagramId;
    return fromSteps ?? allDiagrams[0]?.id ?? null;
  }, [allDiagrams, journey, selectedStep?.diagramId]);

  const handleNameSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!journey || !nameDraft.trim()) return;
    updateJourney(journey.id, { name: nameDraft.trim() });
    setEditingName(false);
  };

  if (!journeyId) {
    navigate("/journeys", { replace: true });
    return null;
  }

  if (!journey) {
    return (
      <div className="min-h-screen pt-16">
        <Navbar />
        <div className="container mx-auto p-8 text-sm text-muted-foreground">
          {t("journeys.editor.journeyNotFound")}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden pt-16">
      <Navbar />
      <div className="flex min-h-0 h-[calc(100vh-4rem)] flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 shrink-0"
            asChild
          >
            <Link to="/journeys" aria-label={t("journeys.editor.backToList")}>
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </Button>

          {editingName ? (
            <form onSubmit={handleNameSubmit} className="min-w-0 flex-1">
              <input
                value={nameDraft}
                onChange={(event) => setNameDraft(event.target.value)}
                onBlur={() => {
                  if (nameDraft.trim()) {
                    updateJourney(journey.id, { name: nameDraft.trim() });
                  } else {
                    setNameDraft(journey.name);
                  }
                  setEditingName(false);
                }}
                className="w-full max-w-md rounded border border-input bg-background px-2 py-1 text-sm font-semibold"
                autoFocus
              />
            </form>
          ) : (
            <button
              type="button"
              className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-foreground hover:underline"
              onClick={() => {
                setNameDraft(journey.name);
                setEditingName(true);
              }}
            >
              {journey.name}
            </button>
          )}

          {isGlobalPlaying ? (
            <div className="flex shrink-0 items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-muted-foreground"
                disabled={!hasPrevStep}
                onClick={goToPrevStep}
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                {t("journeys.editor.prevStep")}
              </Button>
              {hasNextStep ? (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="h-8 gap-1.5"
                  onClick={goToNextStep}
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                  {t("journeys.editor.nextStep")}
                </Button>
              ) : isLastStep ? (
                <span className="text-xs text-muted-foreground">
                  {t("journeys.editor.journeyCompleted")}
                </span>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-muted-foreground"
                onClick={stopGlobalPlay}
              >
                <Square className="h-3.5 w-3.5 fill-current" />
                {t("journeys.player.exit")}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 shrink-0 gap-1.5"
              disabled={Object.keys(journey.steps).length === 0}
              onClick={startGlobalPlay}
            >
              <Play className="h-3.5 w-3.5" />
              {t("journeys.editor.playJourney")}
            </Button>
          )}
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-h-0 w-[280px] shrink-0 flex-col overflow-hidden border-r border-border bg-card">
            <StepList
              journeyId={journey.id}
              selectedStepId={selectedStepId}
              onSelectStep={handleSelectStep}
            />
            {selectedStepId && !isGlobalPlaying ? (
              <StepDetail
                journeyId={journey.id}
                stepId={selectedStepId}
              />
            ) : !isGlobalPlaying ? (
              <div className="border-t border-border p-3 text-xs text-muted-foreground">
                {t("journeys.editor.selectStepDetail")}
              </div>
            ) : null}
          </div>

          <div className="min-w-0 flex-1">
            <JourneyEditorCanvas
              diagramId={activeDiagramId}
              hasSelectedStep={selectedStepId !== null}
            />
          </div>

          <RightPanel
            journeyId={journey.id}
            step={selectedStep}
            flowSection={
              selectedStepId ? (
                <StepFlowSection
                  journeyId={journey.id}
                  stepId={selectedStepId}
                  onSelectStep={handleSelectStep}
                  onNextStep={isGlobalPlaying ? goToNextStep : undefined}
                  onPrevStep={isGlobalPlaying ? goToPrevStep : undefined}
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("journeys.editor.selectStepForFlow")}
                </p>
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
