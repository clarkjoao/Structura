import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useJourneyActions, useJourneySteps } from "../../selectors";
import type { JourneyStep } from "../../types";
import { AddStepModal } from "./AddStepModal";
import { useAllDiagrams } from "@/features/diagram";

interface StepListProps {
  journeyId: string;
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
}

function readDiagramName(
  diagramId: string | undefined,
  diagramsById: Map<string, string>,
): string | undefined {
  if (!diagramId) return undefined;
  return diagramsById.get(diagramId);
}

export function StepList({
  journeyId,
  selectedStepId,
  onSelectStep,
}: StepListProps) {
  const { t } = useTranslation();
  const steps = useJourneySteps(journeyId);
  const { removeJourneyStep, addJourneyStep } = useJourneyActions();
  const allDiagrams = useAllDiagrams();

  const diagramsById = useMemo(() => {
    const map = new Map<string, string>();
    for (const diagram of allDiagrams) {
      map.set(diagram.id, diagram.name);
    }
    return map;
  }, [allDiagrams]);

  const [addModalOpen, setAddModalOpen] = useState(false);

  const handleAddConfirm = (step: Omit<JourneyStep, "id" | "order">) => {
    addJourneyStep(journeyId, step);
    setAddModalOpen(false);
  };

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-border bg-card">
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {steps.map((step, index) => {
          const previous = index > 0 ? steps[index - 1] : undefined;
          const showDiagramDivider =
            index > 0 &&
            previous &&
            previous.diagramId !== step.diagramId;
          const diagramLabel = readDiagramName(step.diagramId, diagramsById);

          return (
            <div key={step.id}>
              {showDiagramDivider ? (
                <div className="my-2 flex items-center gap-2 text-[10px] text-muted-foreground/80">
                  <span className="shrink-0">──</span>
                  <span className="min-w-0 truncate font-medium">
                    {diagramLabel ?? t("journeys.noDomain")}
                  </span>
                  <span className="h-px min-w-0 flex-1 bg-border" />
                </div>
              ) : null}
              <button
                type="button"
                onClick={() => {
                  onSelectStep(step.id);
                }}
                className={`
                  group relative mb-1 flex w-full items-center gap-2 rounded-md border border-transparent px-2 py-2 text-left text-sm transition-colors
                  ${
                    selectedStepId === step.id
                      ? "border-primary/30 bg-primary/10 border-l-2 border-l-primary text-primary"
                      : "hover:bg-muted/50"
                  }
                `}
              >
                <span className="w-6 shrink-0 tabular-nums text-xs text-muted-foreground">
                  {step.order + 1}
                </span>
                <span className="min-w-0 flex-1 truncate font-medium text-foreground">
                  {step.label}
                </span>
                <button
                  type="button"
                  className="absolute right-1 top-1/2 -translate-y-1/2 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                  aria-label={t("common.delete")}
                  onClick={(event) => {
                    event.stopPropagation();
                    removeJourneyStep(journeyId, step.id);
                  }}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </button>
              {diagramLabel &&
              step.diagramId &&
              (!previous || previous.diagramId !== step.diagramId) ? (
                <p className="-mt-0.5 mb-1 px-2 text-[11px] text-muted-foreground">
                  {diagramLabel}
                </p>
              ) : null}
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 shrink-0 border-t border-border bg-card p-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 w-full gap-1.5 text-xs"
          onClick={() => setAddModalOpen(true)}
        >
          <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t("journeys.editor.addStep")}
        </Button>
      </div>

      <AddStepModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        journeyId={journeyId}
        onConfirm={handleAddConfirm}
      />
    </div>
  );
}
