import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Button } from "@/components/ui/button";
import { useAllDiagrams } from "@/features/diagram";
import {
  JourneyEditorCanvas,
  RightPanel,
  StepDetail,
  StepList,
  useJourney,
  useJourneyActions,
  useJourneyPlayer,
} from "@/features/journeys";

export default function JourneyEditorPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const params = useParams();
  const journeyId = params.id ?? "";
  const journey = useJourney(journeyId);
  const allDiagrams = useAllDiagrams();
  const { updateJourney, addJourneyStep, updateJourneyStep } =
    useJourneyActions();
  const journeyPlayer = useJourneyPlayer();
  const {
    setPlaybackContext,
    selectStep: journeySelectStep,
    mode: journeyPlayerMode,
  } = journeyPlayer;

  const [selectedStepId, setSelectedStepId] = useState<string | null>(null);
  const [rightPanelCollapsed, setRightPanelCollapsed] = useState(false);
  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");

  const journeyKey = journey?.id ?? "";

  useEffect(() => {
    if (!journey) return;
    setSelectedStepId(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when switching journey
  }, [journeyKey]);

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
    (stepId: string) => {
      setSelectedStepId(stepId);
      if (journeyPlayerMode.kind === "playing") {
        journeySelectStep(stepId);
      }
    },
    [journeyPlayerMode.kind, journeySelectStep],
  );

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

  const selectedComponentForCanvas =
    selectedStep?.diagramId === activeDiagramId && selectedStep?.componentId
      ? selectedStep.componentId
      : null;

  const handleCanvasSelectComponent = useCallback(
    (componentId: string, nodeName: string) => {
      if (!journey) return;
      if (selectedStepId === null) {
        const created = addJourneyStep(journey.id, {
          label: nodeName,
          diagramId: activeDiagramId ?? undefined,
          componentId,
        });
        setSelectedStepId(created.id);
        return;
      }
      const step = journey.steps[selectedStepId];
      if (!step) return;
      if (!step.componentId) {
        const labelTrimmed = step.label?.trim() ?? "";
        updateJourneyStep(journey.id, selectedStepId, {
          componentId,
          ...(labelTrimmed === "" ? { label: nodeName } : {}),
          ...(!step.diagramId && activeDiagramId
            ? { diagramId: activeDiagramId }
            : {}),
        });
        toast.success(t("journeys.editor.elementLinked"));
        return;
      }
      const created = addJourneyStep(journey.id, {
        label: nodeName,
        diagramId: activeDiagramId ?? undefined,
        componentId,
      });
      setSelectedStepId(created.id);
    },
    [
      activeDiagramId,
      addJourneyStep,
      journey,
      selectedStepId,
      t,
      updateJourneyStep,
    ],
  );

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
    <div className="flex min-h-screen flex-col overflow-hidden pt-16">
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
        </header>

        <div className="flex min-h-0 flex-1">
          <div className="flex w-[280px] shrink-0 flex-col border-r border-border bg-card">
            <StepList
              journeyId={journey.id}
              selectedStepId={selectedStepId}
              onSelectStep={handleSelectStep}
            />
            {selectedStepId ? (
              <StepDetail journeyId={journey.id} stepId={selectedStepId} />
            ) : (
              <div className="border-t border-border p-3 text-xs text-muted-foreground">
                {t("journeys.editor.selectStepDetail")}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <JourneyEditorCanvas
              diagramId={activeDiagramId}
              hasSelectedStep={selectedStepId !== null}
              selectedStepId={selectedStepId}
              selectedComponentId={selectedComponentForCanvas}
              onSelectComponent={handleCanvasSelectComponent}
              fitOnStepId={selectedStepId}
              fitComponentId={
                selectedStep?.componentId &&
                selectedStep.diagramId === activeDiagramId
                  ? selectedStep.componentId
                  : null
              }
            />
          </div>

          <RightPanel
            journeyId={journey.id}
            step={selectedStep}
            collapsed={rightPanelCollapsed}
            onToggleCollapse={() =>
              setRightPanelCollapsed((previous) => !previous)
            }
          />
        </div>
      </div>
    </div>
  );
}
