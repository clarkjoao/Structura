import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronRight, X } from "lucide-react";
import { toast } from "sonner";
import type { FlowLinkTarget, FlowStep } from "@/features/diagram";
import { isConditionStep, isFlowLinkStep, useActiveDiagram, useDiagrams } from "@/features/diagram";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

const MAX_FORK_BRANCH_LABELS = 6;

export interface StepDetailEditorProps {
  step: FlowStep;
  stepIndex: number;
  conditionSteps: FlowStep[];
  editingFlowId: string | null;
  isLeaf: boolean;
  onUpdateStepDescription: (index: number, value: string) => void;
  onUpdateStepDuration: (index: number, value: string) => void;
  onUpdateStepPayload: (index: number, value: string) => void;
  onUpdateStepPayloadDirection: (index: number, direction: "request" | "response") => void;
  onUpdateStepIsAsync: (index: number, value: boolean) => void;
  onConvertStepToCondition: (index: number, conditionLabel: string, branchLabels: string[]) => void;
  onSetFlowLink: (stepId: string, target: FlowLinkTarget) => void;
  onRemoveFlowLink: (stepId: string) => void;
  onClose: () => void;
}

export function StepDetailEditor({
  step,
  stepIndex,
  conditionSteps: _conditionSteps,
  editingFlowId,
  isLeaf,
  onUpdateStepDescription,
  onUpdateStepDuration,
  onUpdateStepPayload,
  onUpdateStepPayloadDirection,
  onUpdateStepIsAsync,
  onConvertStepToCondition,
  onSetFlowLink,
  onRemoveFlowLink,
  onClose: _onClose,
}: StepDetailEditorProps) {
  void _conditionSteps;
  void _onClose;
  const { t } = useTranslation();
  const diagrams = useDiagrams();
  const activeDiagram = useActiveDiagram();

  const [forkOpen, setForkOpen] = useState(false);
  const defaultConditionLabel = t("flowMap.defaultConditionLabel");
  const defaultBranchA = t("flowMap.defaultBranchA");
  const defaultBranchB = t("flowMap.defaultBranchB");
  const [forkConditionLabel, setForkConditionLabel] = useState(defaultConditionLabel);
  const [forkBranchLabels, setForkBranchLabels] = useState<string[]>([defaultBranchA, defaultBranchB]);

  const [selectedDiagramId, setSelectedDiagramId] = useState<string>(() => activeDiagram?.id ?? "");
  const [selectedFlowId, setSelectedFlowId] = useState<string>("");

  useEffect(() => {
    if (isFlowLinkStep(step)) {
      setSelectedDiagramId(step.targetDiagramId);
      setSelectedFlowId(step.targetFlowId);
      return;
    }
    if (activeDiagram?.id) setSelectedDiagramId(activeDiagram.id);
    setSelectedFlowId("");
  }, [step, activeDiagram?.id]);

  useEffect(() => {
    setForkConditionLabel(defaultConditionLabel);
    setForkBranchLabels([defaultBranchA, defaultBranchB]);
  }, [step.id, defaultConditionLabel, defaultBranchA, defaultBranchB]);

  const showForkSection = !isConditionStep(step) && !isFlowLinkStep(step);
  const showLinkSection = isLeaf && !isConditionStep(step);

  const handleForkCreate = () => {
    const trimmed = forkBranchLabels.map((label) => label.trim()).filter(Boolean);
    if (trimmed.length < 2) {
      toast.warning(t("flowRecorder.minBranchesWarning"));
      return;
    }
    onConvertStepToCondition(
      stepIndex,
      forkConditionLabel.trim() || defaultConditionLabel,
      trimmed.slice(0, MAX_FORK_BRANCH_LABELS),
    );
    setForkOpen(false);
  };

  return (
    <div className="space-y-3 pt-1">
      {/* Basic fields */}
      {!isFlowLinkStep(step) ? (
        <>
          <label className="block space-y-1">
            <span className="text-[10px] font-medium text-muted-foreground">{t("stepDetail.description")}</span>
            <textarea
              value={step.description ?? ""}
              onChange={(event) => onUpdateStepDescription(stepIndex, event.target.value)}
              placeholder={t("flowRecorder.stepDescPlaceholder")}
              rows={3}
              className="w-full rounded border border-border bg-secondary px-2 py-1.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
            />
          </label>
          <label className="block space-y-1">
            <span className="text-[10px] font-medium text-muted-foreground">{t("stepDetail.duration")}</span>
            <input
              value={step.duration ?? ""}
              onChange={(event) => onUpdateStepDuration(stepIndex, event.target.value)}
              placeholder={t("flowRecorder.durationPlaceholder")}
              className="w-full rounded border border-border bg-secondary px-2 py-1.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </label>
          <label className="flex items-center gap-2 text-[10px] text-muted-foreground cursor-pointer">
            <input
              type="checkbox"
              checked={step.isAsync ?? false}
              onChange={(event) => onUpdateStepIsAsync(stepIndex, event.target.checked)}
              className="rounded"
            />
            {t("stepDetail.async")}
          </label>
          <div className="space-y-1">
            <span className="text-[10px] font-medium text-muted-foreground block">{t("stepDetail.payload")}</span>
            <div className="flex rounded border border-border overflow-hidden w-fit">
              <button
                type="button"
                onClick={() => onUpdateStepPayloadDirection(stepIndex, "request")}
                className={cn(
                  "px-2 py-0.5 text-[9px] font-medium transition-colors",
                  (step.payloadDirection ?? "request") === "request"
                    ? "bg-cyan-500/20 text-cyan-400"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {t("stepDetail.payloadDirection.request")}
              </button>
              <button
                type="button"
                onClick={() => onUpdateStepPayloadDirection(stepIndex, "response")}
                className={cn(
                  "px-2 py-0.5 text-[9px] font-medium transition-colors",
                  step.payloadDirection === "response"
                    ? "bg-emerald-500/20 text-emerald-400"
                    : "bg-secondary text-muted-foreground hover:text-foreground",
                )}
              >
                {t("stepDetail.payloadDirection.response")}
              </button>
            </div>
          </div>
          <textarea
            value={step.payload ?? ""}
            onChange={(event) => onUpdateStepPayload(stepIndex, event.target.value)}
            placeholder={t("flowRecorder.payloadPlaceholder")}
            rows={3}
            className="w-full rounded border border-border bg-secondary px-2 py-1.5 text-[10px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
          />
        </>
      ) : (
        <label className="block space-y-1">
          <span className="text-[10px] font-medium text-muted-foreground">{t("stepDetail.description")}</span>
          <textarea
            value={step.description ?? ""}
            onChange={(event) => onUpdateStepDescription(stepIndex, event.target.value)}
            placeholder={t("flowRecorder.stepDescPlaceholder")}
            rows={2}
            className="w-full rounded border border-border bg-secondary px-2 py-1.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
          />
        </label>
      )}

      {showForkSection ? (
        <Collapsible open={forkOpen} onOpenChange={setForkOpen}>
          <CollapsibleTrigger className="flex w-full items-center gap-1 rounded-md border border-border bg-secondary/40 px-2 py-1.5 text-left text-[10px] font-semibold text-foreground hover:bg-secondary/60">
            <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 transition-transform", forkOpen && "rotate-90")} />
            {t("stepDetail.forkHere")}
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-2 space-y-2 border border-t-0 border-border rounded-b-md px-2 pb-2 bg-card">
            <label className="block space-y-0.5">
              <span className="text-[9px] text-muted-foreground">{t("flowMap.conditionLabel")}</span>
              <input
                value={forkConditionLabel}
                onChange={(event) => setForkConditionLabel(event.target.value)}
                className="w-full rounded border border-border bg-secondary px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </label>
            <div className="space-y-1">
              {forkBranchLabels.map((branchLabelValue, branchLabelIndex) => (
                <div key={branchLabelIndex} className="flex items-center gap-1">
                  <input
                    value={branchLabelValue}
                    onChange={(event) => {
                      const nextLabels = [...forkBranchLabels];
                      nextLabels[branchLabelIndex] = event.target.value;
                      setForkBranchLabels(nextLabels);
                    }}
                    placeholder={t("flowMap.newBranch")}
                    aria-label={t("flowMap.branchLabelSlot", { n: branchLabelIndex + 1 })}
                    className="min-w-0 flex-1 rounded border border-border bg-secondary px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                  {forkBranchLabels.length > 2 ? (
                    <button
                      type="button"
                      onClick={() =>
                        setForkBranchLabels(forkBranchLabels.filter((_, indexRemove) => indexRemove !== branchLabelIndex))
                      }
                      className="shrink-0 p-0.5 text-muted-foreground hover:text-destructive"
                      aria-label={t("common.delete")}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
            {forkBranchLabels.length < MAX_FORK_BRANCH_LABELS ? (
              <button
                type="button"
                onClick={() => setForkBranchLabels([...forkBranchLabels, ""])}
                className="w-full rounded border border-dashed border-border py-1 text-[10px] font-medium text-muted-foreground hover:bg-secondary/60"
              >
                + {t("flowMap.addBranch")}
              </button>
            ) : null}
            <div className="flex gap-2 pt-1">
              <button
                type="button"
                onClick={() => setForkOpen(false)}
                className="flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
              >
                {t("stepDetail.forkCancel")}
              </button>
              <button
                type="button"
                onClick={handleForkCreate}
                className="flex-1 rounded-md bg-primary px-2 py-1.5 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {t("stepDetail.forkCreate")}
              </button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      ) : null}

      {showLinkSection ? (
        <div className="rounded-md border border-amber-500/30 bg-amber-500/5 p-2 space-y-2">
          <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-400">{t("stepDetail.linkToFlow")}</p>
          {isFlowLinkStep(step) ? (
            <div className="space-y-2">
              <p className="text-[10px] text-foreground">
                <span aria-hidden>🔗</span> {step.targetFlowName}
              </p>
              <p className="text-[9px] text-muted-foreground">{t("stepDetail.currentLink", { diagram: step.targetDiagramName })}</p>
              <button
                type="button"
                onClick={() => onRemoveFlowLink(step.id)}
                className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground"
              >
                {t("stepDetail.linkRemove")}
              </button>
            </div>
          ) : (
            <>
              <label className="block space-y-1">
                <span className="text-[9px] text-muted-foreground">{t("stepDetail.linkDiagram")}</span>
                <select
                  value={selectedDiagramId}
                  onChange={(event) => {
                    setSelectedDiagramId(event.target.value);
                    setSelectedFlowId("");
                  }}
                  className="w-full rounded border border-border bg-secondary px-2 py-1.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                >
                  <option value="">{t("flowLink.selectDiagram")}</option>
                  {Object.values(diagrams).map((diagram) => (
                    <option key={diagram.id} value={diagram.id}>
                      {diagram.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1">
                <span className="text-[9px] text-muted-foreground">{t("stepDetail.linkFlow")}</span>
                <select
                  value={selectedFlowId}
                  onChange={(event) => setSelectedFlowId(event.target.value)}
                  disabled={!selectedDiagramId}
                  className="w-full rounded border border-border bg-secondary px-2 py-1.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring disabled:opacity-50"
                >
                  <option value="">{t("flowLink.selectFlow")}</option>
                  {Object.values(diagrams[selectedDiagramId ?? ""]?.snapshot.flows ?? {})
                    .filter((flow) => flow.id !== editingFlowId)
                    .map((flow) => (
                      <option key={flow.id} value={flow.id}>
                        {flow.name}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                disabled={!selectedDiagramId || !selectedFlowId}
                onClick={() => {
                  const diagram = diagrams[selectedDiagramId];
                  const targetFlow = diagram?.snapshot.flows?.[selectedFlowId];
                  if (!diagram || !targetFlow) return;
                  onSetFlowLink(step.id, {
                    targetFlowId: targetFlow.id,
                    targetFlowName: targetFlow.name,
                    targetDiagramId: diagram.id,
                    targetDiagramName: diagram.name,
                  });
                }}
                className="w-full rounded-md bg-amber-500 px-2 py-1.5 text-[10px] font-semibold text-amber-950 hover:bg-amber-500/90 disabled:opacity-50"
              >
                {t("stepDetail.linkButton")}
              </button>
            </>
          )}
        </div>
      ) : null}
    </div>
  );
}
