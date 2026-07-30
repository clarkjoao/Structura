import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Plus, X } from "lucide-react";
import { useAllDiagrams } from "@/features/diagram/store";
import { cn } from "@/lib/utils";
import {
  useWalkthroughActions,
  useWalkthroughSteps,
} from "../../store/selectors/walkthroughs.selectors";
import type { WalkthroughStep } from "../../types";
import { AddStepModal } from "./AddStepModal";

interface StepListProps {
  walkthroughId: string;
  selectedStepId: string | null;
  onSelectStep: (stepId: string) => void;
  isGlobalPlaying: boolean;
}

function readDiagramName(
  diagramId: string | undefined,
  diagramsById: Map<string, string>,
): string | undefined {
  if (!diagramId) return undefined;
  return diagramsById.get(diagramId);
}

function StepConnector() {
  return (
    <div className="flex flex-col items-center py-0.5">
      <div className="h-4 w-px border-l-2 border-dashed border-border/50" />
      <ChevronDown className="-mt-1 h-3 w-3 text-muted-foreground/40" aria-hidden />
    </div>
  );
}

interface StepCardProps {
  step: WalkthroughStep;
  diagramSubtitle?: string;
  selected: boolean;
  isGlobalPlaying: boolean;
  onClick: () => void;
  onDelete: () => void;
}

function StepCard({
  step,
  diagramSubtitle,
  selected,
  isGlobalPlaying,
  onClick,
  onDelete,
}: StepCardProps) {
  const { t } = useTranslation();

  return (
    <div
      className={cn(
        "group relative w-full rounded-lg border border-border bg-card transition-all",
        selected
          ? "border-primary bg-primary/8 shadow-sm hover:bg-primary/10"
          : "hover:bg-muted/50",
      )}
    >
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "w-full px-3 py-2.5 text-left",
          isGlobalPlaying ? "cursor-default" : "cursor-pointer pr-9",
        )}
      >
        <div className="flex gap-2.5">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] font-medium tabular-nums text-muted-foreground">
            {step.order + 1}
          </span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-medium text-foreground">{step.label}</div>
            {step.diagramId && diagramSubtitle ? (
              <div className="truncate text-[11px] text-muted-foreground">{diagramSubtitle}</div>
            ) : null}
          </div>
        </div>
      </button>
      {!isGlobalPlaying ? (
        <button
          type="button"
          className="absolute right-1 top-1/2 z-10 -translate-y-1/2 rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
          aria-label={t("common.delete")}
          onClick={(event) => {
            event.stopPropagation();
            onDelete();
          }}
        >
          <X className="h-3.5 w-3.5" aria-hidden />
        </button>
      ) : null}
    </div>
  );
}

export function StepList({
  walkthroughId,
  selectedStepId,
  onSelectStep,
  isGlobalPlaying,
}: StepListProps) {
  const { t } = useTranslation();
  const steps = useWalkthroughSteps(walkthroughId);
  const { removeWalkthroughStep, addWalkthroughStep } = useWalkthroughActions();
  const allDiagrams = useAllDiagrams();

  const diagramsById = useMemo(() => {
    const map = new Map<string, string>();
    for (const diagram of allDiagrams) {
      map.set(diagram.id, diagram.name);
    }
    return map;
  }, [allDiagrams]);

  const [addModalOpen, setAddModalOpen] = useState(false);

  const handleAddConfirm = (step: Omit<WalkthroughStep, "id" | "order">) => {
    const created = addWalkthroughStep(walkthroughId, step);
    onSelectStep(created.id);
    setAddModalOpen(false);
  };

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-border bg-card">
      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {steps.map((step, index) => {
          const diagramSubtitle =
            step.diagramId !== undefined
              ? (readDiagramName(step.diagramId, diagramsById) ?? step.diagramId)
              : undefined;

          return (
            <div key={step.id}>
              <StepCard
                step={step}
                diagramSubtitle={diagramSubtitle}
                selected={selectedStepId === step.id}
                isGlobalPlaying={isGlobalPlaying}
                onClick={() => {
                  onSelectStep(step.id);
                }}
                onDelete={() => {
                  removeWalkthroughStep(walkthroughId, step.id);
                }}
              />
              {index < steps.length - 1 ? <StepConnector /> : null}
            </div>
          );
        })}
      </div>

      <div className="sticky bottom-0 shrink-0 border-t border-border bg-card p-2">
        {steps.length > 0 ? <StepConnector /> : null}
        {!isGlobalPlaying ? (
          <button
            type="button"
            className="flex w-full items-center justify-center gap-1 rounded-lg border-2 border-dashed border-border/50 py-2 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
            onClick={() => setAddModalOpen(true)}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
            {t("walkthroughs.editor.addStep")}
          </button>
        ) : null}
      </div>

      <AddStepModal
        open={addModalOpen}
        onOpenChange={setAddModalOpen}
        walkthroughId={walkthroughId}
        onConfirm={handleAddConfirm}
      />
    </div>
  );
}
