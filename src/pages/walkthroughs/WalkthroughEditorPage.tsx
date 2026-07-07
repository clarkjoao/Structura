import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, Play, Square } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useFlowMode } from "@/features/canvas";
import { useAllDiagrams } from "@/features/diagram";
import {
  JourneyCompletedOverlay,
  JourneyEditorCanvas,
  RightPanel,
  StepDetail,
  StepFlowSection,
  StepList,
  useWalkthrough,
  useWalkthroughActions,
  useWalkthroughGlobalPlayer,
  useWalkthroughPlayer,
  useWalkthroughSteps,
} from "@/features/walkthroughs";

export default function WalkthroughEditorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const walkthroughId = params.id ?? "";
  const walkthrough = useWalkthrough(walkthroughId);
  const steps = useWalkthroughSteps(walkthroughId);
  const allDiagrams = useAllDiagrams();
  const { updateWalkthrough } = useWalkthroughActions();
  const flowMode = useFlowMode();
  const journeyPlayer = useWalkthroughPlayer();
  const {
    setPlaybackContext,
    selectStep: journeySelectStep,
    mode: journeyPlayerMode,
    cancelWalkthroughRecording,
  } = journeyPlayer;

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [visualOverlayOpen, setVisualOverlayOpen] = useState(false);
  const [journeyFinished, setJourneyFinished] = useState(false);

  const journeyKey = walkthrough?.id ?? "";

  useEffect(() => {
    if (!walkthrough) return;
    setSelectedStepId(null);
  }, [walkthrough, journeyKey]);

  useEffect(() => {
    if (steps.length === 0) {
      setSelectedStepId(null);
    }
  }, [steps.length]);

  useEffect(() => {
    if (!selectedStepId) return;
    if (!walkthrough?.steps[selectedStepId]) {
      setSelectedStepId(null);
    }
  }, [selectedStepId, walkthrough]);

  useEffect(() => {
    if (!walkthrough) return;
    setNameDraft(walkthrough.name);
  }, [walkthrough]);

  useEffect(() => {
    const id = walkthrough?.id;
    if (!id) return;
    setPlaybackContext(id, selectedStepId);
  }, [walkthrough?.id, selectedStepId, setPlaybackContext]);

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
        cancelWalkthroughRecording();
      } else if (flowMode.isRecording) {
        flowMode.cancelRecording();
      }
    },
    [cancelWalkthroughRecording, flowMode, journeyPlayerMode.kind, journeySelectStep],
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
  } = useWalkthroughGlobalPlayer({
    walkthroughId,
    selectedStepId,
    onSelectStep: handleSelectStep,
  });

  const selectedStep = walkthrough && selectedStepId ? walkthrough.steps[selectedStepId] : null;

  useEffect(() => {
    setVisualOverlayOpen(false);
  }, [selectedStepId]);

  useEffect(() => {
    if (!isGlobalPlaying) {
      setVisualOverlayOpen(false);
    }
  }, [isGlobalPlaying]);

  useEffect(() => {
    if (isGlobalPlaying) {
      setJourneyFinished(false);
    }
  }, [isGlobalPlaying]);

  const flowExitPlay = flowMode.exitPlay;
  const flowIsPlaying = flowMode.isPlaying;
  const flowIsIdle = flowMode.isIdle;
  const flowCanGoForward = flowMode.canGoForward;
  const flowCanGoBack = flowMode.canGoBack;
  const flowGoNext = flowMode.goNext;
  const flowGoBack = flowMode.goBack;

  const goToNextStepRef = useRef(goToNextStep);
  const goToPrevStepRef = useRef(goToPrevStep);
  const stopGlobalPlayRef = useRef(stopGlobalPlay);
  goToNextStepRef.current = goToNextStep;
  goToPrevStepRef.current = goToPrevStep;
  stopGlobalPlayRef.current = stopGlobalPlay;

  useEffect(() => {
    if (!isGlobalPlaying) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT"
      ) {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      switch (event.key) {
        case "ArrowRight": {
          event.preventDefault();
          if (flowCanGoForward) {
            flowGoNext();
          }
          break;
        }
        case "ArrowLeft": {
          event.preventDefault();
          if (flowCanGoBack) {
            flowGoBack();
          }
          break;
        }
        case "ArrowDown": {
          event.preventDefault();
          goToNextStepRef.current();
          break;
        }
        case "ArrowUp": {
          event.preventDefault();
          goToPrevStepRef.current();
          break;
        }
        case "Escape": {
          event.preventDefault();
          stopGlobalPlayRef.current();
          break;
        }
        case " ": {
          event.preventDefault();
          if (flowIsPlaying) {
            flowExitPlay();
          } else if (flowIsIdle && selectedStep?.flowId && selectedStep.diagramId.length > 0) {
            journeyPlayer.startFlowPlayback(selectedStep.flowId, selectedStep.diagramId);
          }
          break;
        }
        default:
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    isGlobalPlaying,
    flowCanGoBack,
    flowCanGoForward,
    flowGoBack,
    flowGoNext,
    flowIsPlaying,
    flowIsIdle,
    flowExitPlay,
    selectedStep,
    journeyPlayer,
  ]);

  const handlePresentationJourneyComplete = useCallback(() => {
    setJourneyFinished(true);
  }, []);

  useEffect(() => {
    return () => {
      stopGlobalPlayRef.current();
    };
  }, []);

  const activeDiagramId = useMemo(() => {
    if (selectedStep?.diagramId) return selectedStep.diagramId;
    if (!walkthrough) return null;
    const ordered = Object.values(walkthrough.steps).sort(
      (left, right) => left.order - right.order,
    );
    const fromSteps = ordered.find((step) => step.diagramId)?.diagramId;
    return fromSteps ?? allDiagrams[0]?.id ?? null;
  }, [allDiagrams, walkthrough, selectedStep?.diagramId]);

  const currentStepIndex = useMemo(() => {
    if (!selectedStepId) return -1;
    return steps.findIndex((step) => step.id === selectedStepId);
  }, [selectedStepId, steps]);

  const handleNameSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (!walkthrough || !nameDraft.trim()) return;
    updateWalkthrough(walkthrough.id, { name: nameDraft.trim() });
    setEditingName(false);
  };

  if (!walkthroughId) {
    navigate("/walkthroughs", { replace: true });
    return null;
  }

  if (!walkthrough) {
    return (
      <div className="min-h-screen pt-16">
        <Navbar />
        <div className="container mx-auto p-8 text-sm text-muted-foreground">
          {t("walkthroughs.player.walkthroughNotFound")}
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden pt-16">
      <Navbar />
      <div className="flex min-h-0 h-[calc(100vh-4rem)] flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-2 border-b border-border bg-card px-3">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0" asChild>
            <Link to="/walkthroughs" aria-label={t("walkthroughs.editor.backToList")}>
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
                    updateWalkthrough(walkthrough.id, { name: nameDraft.trim() });
                  } else {
                    setNameDraft(walkthrough.name);
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
                setNameDraft(walkthrough.name);
                setEditingName(true);
              }}
            >
              {walkthrough.name}
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
                {t("walkthroughs.editor.prevStep")}
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
                  {t("walkthroughs.editor.nextStep")}
                </Button>
              ) : isLastStep ? (
                <span className="text-xs text-muted-foreground">
                  {t("walkthroughs.editor.journeyCompleted")}
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
                {t("walkthroughs.player.exit")}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="h-8 shrink-0 gap-1.5"
              disabled={Object.keys(walkthrough.steps).length === 0}
              onClick={startGlobalPlay}
            >
              <Play className="h-3.5 w-3.5" />
              {t("walkthroughs.editor.playJourney")}
            </Button>
          )}
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="flex min-h-0 w-[280px] shrink-0 flex-col overflow-hidden border-r border-border bg-card">
            <StepList
              walkthroughId={walkthrough.id}
              selectedStepId={selectedStepId}
              onSelectStep={handleSelectStep}
              isGlobalPlaying={isGlobalPlaying}
            />
            {selectedStepId && !isGlobalPlaying ? (
              <StepDetail walkthroughId={walkthrough.id} stepId={selectedStepId} />
            ) : !isGlobalPlaying ? (
              <div className="border-t border-border p-3 text-xs text-muted-foreground">
                {t("walkthroughs.editor.selectStepDetail")}
              </div>
            ) : null}
          </div>

          <div className="relative min-w-0 flex-1">
            <JourneyEditorCanvas
              diagramId={activeDiagramId}
              hasSelectedStep={selectedStepId !== null}
              isGlobalPlaying={isGlobalPlaying}
              showVisualOverlay={visualOverlayOpen}
              selectedStep={selectedStep}
              onCloseVisualOverlay={() => setVisualOverlayOpen(false)}
              stepDescriptionProps={
                isGlobalPlaying && selectedStep
                  ? {
                      step: selectedStep,
                      stepIndex: currentStepIndex,
                      totalSteps: steps.length,
                    }
                  : null
              }
            />
            {journeyFinished ? (
              <JourneyCompletedOverlay
                walkthroughName={walkthrough.name}
                onRestart={() => {
                  setJourneyFinished(false);
                  startGlobalPlay();
                }}
                onExit={() => {
                  setJourneyFinished(false);
                  stopGlobalPlay();
                }}
              />
            ) : null}
          </div>

          <RightPanel
            walkthroughId={walkthrough.id}
            step={selectedStep}
            isGlobalPlaying={isGlobalPlaying}
            onExpandVisual={isGlobalPlaying ? () => setVisualOverlayOpen(true) : undefined}
            flowSection={
              selectedStepId ? (
                <StepFlowSection
                  walkthroughId={walkthrough.id}
                  stepId={selectedStepId}
                  onSelectStep={handleSelectStep}
                  onNextStep={isGlobalPlaying ? goToNextStep : undefined}
                  onPrevStep={isGlobalPlaying ? goToPrevStep : undefined}
                  onLastStepFlowCompleted={
                    isGlobalPlaying ? handlePresentationJourneyComplete : undefined
                  }
                  onWalkthroughComplete={
                    isGlobalPlaying ? handlePresentationJourneyComplete : undefined
                  }
                />
              ) : (
                <p className="text-sm text-muted-foreground">
                  {t("walkthroughs.editor.selectStepForFlow")}
                </p>
              )
            }
          />
        </div>
      </div>
    </div>
  );
}
