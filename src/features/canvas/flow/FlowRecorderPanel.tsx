import { useState, useCallback, useMemo } from "react";
import {
  useComponents,
  useConnections,
  stepsToMermaid,
  buildFlowFromRecordingSnapshot,
  getBranchStepCount,
} from "@/features/diagram";
import type { FlowStep, Flow } from "@/features/diagram";
import { X, GripVertical, Copy, Check, GitBranch, ArrowLeft, ChevronRight } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { BranchOwnerInfo, RecordingContext } from "./RecordingModeContext";
import { getBranchColor } from "./branchColors";

interface Props {
  recordingContext: RecordingContext;
  setRecordingContext: React.Dispatch<React.SetStateAction<RecordingContext>>;
  name: string;
  onNameChange: (name: string) => void;
  description: string;
  onDescriptionChange: (desc: string) => void;
  tags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (index: number) => void;
  /** Steps shown in the list (full trunk or current branch only). */
  steps: FlowStep[];
  /** Full recording sequence for Mermaid preview and branch metrics. */
  recordingSteps: FlowStep[];
  branchOwnership: Map<string, BranchOwnerInfo>;
  onCancel: () => void;
  onFinalize: () => void;
  onUpdateStepDescription: (index: number, description: string) => void;
  onUpdateStepDuration: (index: number, duration: string) => void;
  onUpdateStepPayload: (index: number, payload: string) => void;
  onUpdateStepPayloadDirection: (index: number, direction: "request" | "response") => void;
  onUpdateStepIsAsync: (index: number, isAsync: boolean) => void;
  onDeleteStep: (index: number) => void;
  onReorderSteps: (fromIndex: number, toIndex: number) => void;
  onConvertStepToCondition: (index: number, conditionLabel: string, branchLabels: string[]) => void;
  onUpdateConditionLabel: (index: number, label: string) => void;
  onAddBranchLabel: (conditionStepId: string, label: string) => void;
  onRemoveBranchLabel: (conditionStepId: string, branchIndex: number) => void;
  onUpdateBranchLabel: (conditionStepId: string, branchIndex: number, label: string) => void;
  onAddConditionStep: (conditionLabel: string, branchLabels: string[]) => void;
  onEnterBranchRecording: (conditionStepId: string, branchIndex: number) => void;
  onOpenBranchSelect: (conditionStepId: string) => void;
  isEditing?: boolean;
}

const FlowRecorderPanel = ({
  recordingContext,
  setRecordingContext,
  name,
  onNameChange,
  description,
  onDescriptionChange,
  tags,
  onAddTag,
  onRemoveTag,
  steps,
  recordingSteps,
  branchOwnership,
  onCancel,
  onFinalize,
  onUpdateStepDescription,
  onUpdateStepDuration,
  onUpdateStepPayload,
  onUpdateStepPayloadDirection,
  onUpdateStepIsAsync,
  onDeleteStep,
  onReorderSteps,
  onConvertStepToCondition,
  onUpdateConditionLabel,
  onAddBranchLabel,
  onRemoveBranchLabel,
  onUpdateBranchLabel,
  onAddConditionStep,
  onEnterBranchRecording,
  onOpenBranchSelect,
  isEditing,
}: Props) => {
  const { t } = useTranslation();
  const components = useComponents();
  const connections = useConnections();
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [copiedMermaid, setCopiedMermaid] = useState(false);
  const [conditionForm, setConditionForm] = useState<{ index: number; label: string; branches: string[] } | null>(null);

  const previewFlow: Flow = useMemo(
    () => buildFlowFromRecordingSnapshot(recordingSteps, branchOwnership, { name }),
    [recordingSteps, branchOwnership, name],
  );

  const participants = useMemo(() => {
    return [
      ...new Set(
        recordingSteps
          .map((s) => (s.componentId ? components[s.componentId]?.name : null))
          .filter(Boolean) as string[],
      ),
    ];
  }, [recordingSteps, components]);

  const getStepLabel = useCallback(
    (step: FlowStep): string => {
      if (step.type === "condition") {
        return `◇ ${step.conditionLabel ?? t("flowRecorder.condition")}`;
      }
      if (step.connectionId) {
        const conn = connections[step.connectionId];
        if (conn) return `${t("flowRecorder.connectionLabelPrefix")}${conn.label}`;
      }
      if (step.componentId) {
        return components[step.componentId]?.name ?? t("flowRecorder.unknownStep");
      }
      return t("flowRecorder.unknownStep");
    },
    [components, connections, t],
  );

  const handleFinalize = () => {
    if (!name.trim()) toast.warning(t("flowRecorder.emptyNameWarning"));
    if (recordingSteps.length === 0) toast.warning(t("flowRecorder.noStepsWarning"));
    onFinalize();
  };

  const handleDelete = (i: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (expandedStep === i) setExpandedStep(null);
    else if (expandedStep !== null && expandedStep > i) setExpandedStep(expandedStep - 1);
    onDeleteStep(i);
  };

  const handleTagKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && e.currentTarget.value.trim()) {
      onAddTag(e.currentTarget.value.trim());
      e.currentTarget.value = "";
    }
  };

  const handleConditionFormSubmit = () => {
    if (!conditionForm) return;
    const validBranches = conditionForm.branches.filter((b) => b.trim());
    if (validBranches.length < 2) {
      toast.warning(t("flowRecorder.minBranchesWarning", "At least 2 branches required"));
      return;
    }
    if (conditionForm.index === -1) {
      onAddConditionStep(conditionForm.label, validBranches);
    } else {
      onConvertStepToCondition(conditionForm.index, conditionForm.label, validBranches);
    }
    setConditionForm(null);
  };

  const cancelConditionDialog = () => setConditionForm(null);

  const mermaidPreview = useMemo(() => {
    const stepsRecord: Record<string, FlowStep> = {};
    for (const s of recordingSteps) stepsRecord[s.id] = s;
    for (let i = 0; i < recordingSteps.length - 1; i++) {
      if (recordingSteps[i].type !== "condition" && !recordingSteps[i].next) {
        stepsRecord[recordingSteps[i].id] = { ...stepsRecord[recordingSteps[i].id], next: recordingSteps[i + 1].id };
      }
    }
    const tempFlow: Flow = {
      id: "preview",
      name,
      mermaid: "",
      diagramId: "",
      entryStepId: recordingSteps[0]?.id,
      steps: stepsRecord,
    };
    return stepsToMermaid(tempFlow, components, connections);
  }, [recordingSteps, components, connections, name]);

  const branchSelectCondition =
    recordingContext.mode === "branch-select"
      ? previewFlow.steps[recordingContext.conditionStepId]
      : undefined;

  const allBranchesDone =
    branchSelectCondition?.branches?.every(
      (b) => getBranchStepCount(previewFlow, b.nextId) > 0,
    ) ?? false;

  const showTrunkBody =
    recordingContext.mode === "trunk" || recordingContext.mode === "branch-record";

  return (
    <div className="w-80 h-full min-h-0 border-l border-border bg-card overflow-hidden flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${isEditing ? "bg-amber-500" : "bg-red-500"} animate-pulse`} />
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {isEditing ? t("flowRecorder.editingTitle") : t("flowRecorder.recordingTitle")}
          </h3>
        </div>
        <button onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="p-3 space-y-3 shrink-0 border-b border-border">
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t("flowRecorder.namePlaceholder")}
          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          autoFocus={recordingContext.mode === "trunk"}
        />

        <input
          value={description}
          onChange={(e) => onDescriptionChange(e.target.value)}
          placeholder={t("flowRecorder.descPlaceholder")}
          className="w-full rounded-md border border-border bg-secondary px-3 py-1.5 text-[11px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
        />

        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{t("flowRecorder.tags")}</p>
          <div className="flex flex-wrap gap-1">
            {tags.map((tag, i) => (
              <span key={i} className="inline-flex items-center gap-0.5 text-[9px] rounded-full bg-secondary px-2 py-0.5 text-secondary-foreground">
                {tag}
                <button onClick={() => onRemoveTag(i)} className="hover:text-destructive ml-0.5">
                  ×
                </button>
              </span>
            ))}
          </div>
          <input
            placeholder={t("flowRecorder.tagPlaceholder")}
            className="w-full rounded border border-border bg-secondary px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            onKeyDown={handleTagKey}
          />
        </div>

        {participants.length > 0 && recordingContext.mode !== "branch-select" && (
          <p className="text-[10px] text-muted-foreground">{participants.join(", ")}</p>
        )}
      </div>

      {recordingContext.mode === "branch-record" && (
        <div
          className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0"
          style={{
            backgroundColor: `${getBranchColor(recordingContext.branchIndex)}15`,
            borderLeftColor: getBranchColor(recordingContext.branchIndex),
            borderLeftWidth: 3,
          }}
        >
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
              {t("flowRecorder.branchRecordingStrip", "Gravando branch")}
            </p>
            <p className="text-sm font-semibold text-foreground truncate">{recordingContext.branchLabel}</p>
          </div>
          <button
            type="button"
            onClick={() =>
              setRecordingContext({ mode: "branch-select", conditionStepId: recordingContext.conditionStepId })
            }
            className="shrink-0 flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground hover:bg-surface-hover"
          >
            <Check className="h-3 w-3" /> {t("flowRecorder.branchOk", "Ok")}
          </button>
        </div>
      )}

      <div className="flex-1 min-h-0 overflow-y-auto flex flex-col">
        {recordingContext.mode === "branch-select" && branchSelectCondition && (
          <div className="flex-1 flex flex-col p-4 space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-amber-500/10 border border-amber-500/20 px-3 py-2">
              <span className="text-amber-400 text-lg">◇</span>
              <span className="text-sm font-medium text-foreground">
                {branchSelectCondition.conditionLabel}
              </span>
            </div>

            <p className="text-xs text-muted-foreground">
              {t("flowRecorder.selectBranchPrompt", "Selecione um branch para gravar:")}
            </p>

            <div className="space-y-2">
              {branchSelectCondition.branches?.map((branch, i) => {
                const stepCount = getBranchStepCount(previewFlow, branch.nextId);
                const isDone = stepCount > 0;
                const color = getBranchColor(i);
                return (
                  <button
                    key={i}
                    type="button"
                    onClick={() => onEnterBranchRecording(recordingContext.conditionStepId, i)}
                    className="w-full flex items-center gap-3 rounded-lg border bg-card hover:bg-surface-hover transition-colors px-4 py-3 text-left"
                    style={{ borderColor: `${color}40` }}
                  >
                    <div className="w-1 self-stretch rounded-full" style={{ backgroundColor: color }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground">{branch.label}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {isDone
                          ? t("flowRecorder.branchStepCount", { count: stepCount, defaultValue: `${stepCount} passo(s)` })
                          : t("flowRecorder.branchEmptyHint", "Vazio — clique para gravar")}
                      </p>
                    </div>
                    {isDone ? (
                      <Check className="h-4 w-4 shrink-0 text-emerald-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>

            {allBranchesDone && (
              <button
                type="button"
                onClick={() => setRecordingContext({ mode: "trunk" })}
                className="flex items-center gap-2 text-sm font-medium text-primary hover:underline"
              >
                <ArrowLeft className="h-4 w-4" /> {t("flowRecorder.continueMainFlow", "Continuar fluxo principal")}
              </button>
            )}
          </div>
        )}

        {showTrunkBody && (
          <div className="p-3 space-y-3 flex-1 min-h-0">
            <div className="space-y-1">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                {t("flowRecorder.stepsHeading", { count: steps.length })}
              </p>
              {steps.length === 0 ? (
                <p className="text-xs text-muted-foreground italic py-2">{t("flowRecorder.recordHint")}</p>
              ) : (
                <div className="space-y-0.5 max-h-48 overflow-auto">
                  {steps.map((step, i) => {
                    const ownerInfo = branchOwnership.get(step.id);
                    const isBranchStep = !!ownerInfo;
                    return (
                      <div key={step.id}>
                        <div
                          draggable
                          onDragStart={(e) => {
                            e.dataTransfer.effectAllowed = "move";
                            setDragIdx(i);
                          }}
                          onDragOver={(e) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            if (dragIdx !== null) setOverIdx(i);
                          }}
                          onDrop={(e) => {
                            e.preventDefault();
                            if (dragIdx !== null && dragIdx !== i) onReorderSteps(dragIdx, i);
                            setDragIdx(null);
                            setOverIdx(null);
                          }}
                          onDragEnd={() => {
                            setDragIdx(null);
                            setOverIdx(null);
                          }}
                          onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                          className={`group flex items-center gap-1 rounded-md px-1.5 py-1.5 text-xs cursor-pointer hover:bg-secondary/50 transition-colors ${
                            i === steps.length - 1 ? "bg-primary/10 text-primary" : "text-foreground"
                          } ${step.type === "condition" ? "border-l-2 border-amber-400" : ""} ${
                            isBranchStep ? "ml-3 border-l border-amber-400/30" : ""
                          } ${dragIdx === i ? "opacity-40" : ""} ${
                            overIdx === i && dragIdx !== null && dragIdx !== i ? "ring-1 ring-primary/50" : ""
                          }`}
                        >
                          <GripVertical className="h-3 w-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 cursor-grab transition-opacity" />
                          <span className="text-[10px] text-muted-foreground shrink-0">{expandedStep === i ? "▾" : "▸"}</span>
                          <span className="font-mono text-[10px] text-muted-foreground w-4 text-right shrink-0">{i + 1}.</span>
                          <span className="truncate flex-1">{getStepLabel(step)}</span>
                          {step.duration && <span className="text-[9px] font-mono text-primary/70 shrink-0">{step.duration}</span>}
                          {step.isAsync && <span className="text-[9px] font-mono text-amber-400 shrink-0">async</span>}
                          {step.handleId && <span className="text-[9px] font-mono text-muted-foreground shrink-0">[{step.handleId}]</span>}
                          <button
                            onClick={(e) => handleDelete(i, e)}
                            className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
                            title={t("flowRecorder.removeStepTitle")}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                        {expandedStep === i && (
                          <div className="pl-7 pr-2 pb-1 pt-0.5 space-y-1">
                            {step.type === "condition" ? (
                              <>
                                <div className="flex items-start gap-1">
                                  <span className="text-[10px] mt-1 shrink-0">◇</span>
                                  <input
                                    value={step.conditionLabel ?? ""}
                                    onChange={(e) => onUpdateConditionLabel(i, e.target.value)}
                                    placeholder={t("flowRecorder.conditionLabelPlaceholder", "Condition label")}
                                    className="w-full rounded border border-border bg-secondary px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenBranchSelect(step.id);
                                  }}
                                  className="w-full rounded-md border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-[10px] font-semibold text-amber-400 hover:bg-amber-500/15"
                                >
                                  {t("flowRecorder.openBranchSelect", "Gravar branches")}
                                </button>
                                <div className="space-y-0.5 pt-1">
                                  <p className="text-[9px] text-muted-foreground font-semibold uppercase">
                                    {t("flowRecorder.branches", "Branches")}
                                  </p>
                                  {step.branches?.map((branch, bi) => {
                                    const color = getBranchColor(bi);
                                    return (
                                      <div key={bi} className="flex items-center gap-1">
                                        <div className="w-1 h-6 rounded-full shrink-0" style={{ backgroundColor: color }} />
                                        <input
                                          value={branch.label}
                                          onChange={(e) => onUpdateBranchLabel(step.id, bi, e.target.value)}
                                          className="flex-1 rounded border border-border bg-secondary px-2 py-0.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                          onClick={(e) => e.stopPropagation()}
                                        />
                                        {(step.branches?.length ?? 0) > 2 && (
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              onRemoveBranchLabel(step.id, bi);
                                            }}
                                            className="text-muted-foreground hover:text-destructive"
                                          >
                                            <X className="h-3 w-3" />
                                          </button>
                                        )}
                                      </div>
                                    );
                                  })}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      onAddBranchLabel(step.id, t("flowRecorder.newBranch", "New branch"));
                                    }}
                                    className="text-[9px] text-primary hover:underline"
                                  >
                                    + {t("flowRecorder.addBranch", "Add branch")}
                                  </button>
                                </div>
                              </>
                            ) : (
                              <>
                                <div className="flex items-start gap-1">
                                  <span className="text-[10px] mt-1 shrink-0">📝</span>
                                  <input
                                    value={step.description ?? ""}
                                    onChange={(e) => onUpdateStepDescription(i, e.target.value)}
                                    placeholder={t("flowRecorder.stepDescPlaceholder")}
                                    className="w-full rounded border border-border bg-secondary px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                <div className="flex items-start gap-1">
                                  <span className="text-[10px] mt-1 shrink-0">⏱</span>
                                  <input
                                    value={step.duration ?? ""}
                                    onChange={(e) => onUpdateStepDuration(i, e.target.value)}
                                    placeholder={t("flowRecorder.durationPlaceholder")}
                                    className="w-full rounded border border-border bg-secondary px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                                    onClick={(e) => e.stopPropagation()}
                                  />
                                </div>
                                {step.connectionId && (
                                  <>
                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                      <span className="text-[10px] mt-0.5 shrink-0">📦</span>
                                      <div className="flex rounded border border-border overflow-hidden">
                                        <button
                                          type="button"
                                          onClick={() => onUpdateStepPayloadDirection(i, "request")}
                                          className={`px-2 py-0.5 text-[9px] font-medium transition-colors ${
                                            (step.payloadDirection ?? "request") === "request"
                                              ? "bg-cyan-500/20 text-cyan-400"
                                              : "bg-secondary text-muted-foreground hover:text-foreground"
                                          }`}
                                        >
                                          {t("flowRecorder.request")}
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => onUpdateStepPayloadDirection(i, "response")}
                                          className={`px-2 py-0.5 text-[9px] font-medium transition-colors ${
                                            step.payloadDirection === "response"
                                              ? "bg-emerald-500/20 text-emerald-400"
                                              : "bg-secondary text-muted-foreground hover:text-foreground"
                                          }`}
                                        >
                                          {t("flowRecorder.response")}
                                        </button>
                                      </div>
                                    </div>
                                    <div className="flex items-start gap-1">
                                      <span className="text-[10px] mt-1 shrink-0">{step.payloadDirection === "response" ? "📥" : "📤"}</span>
                                      <textarea
                                        value={step.payload ?? ""}
                                        onChange={(e) => onUpdateStepPayload(i, e.target.value)}
                                        placeholder={t("flowRecorder.payloadPlaceholder")}
                                        rows={2}
                                        className="w-full rounded border border-border bg-secondary px-2 py-1 text-[10px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </div>
                                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                                      <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={step.isAsync ?? false}
                                          onChange={(e) => onUpdateStepIsAsync(i, e.target.checked)}
                                          className="rounded"
                                        />
                                        Async
                                      </label>
                                    </div>
                                  </>
                                )}
                                {!step.branches && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setConditionForm({ index: i, label: "", branches: ["", ""] });
                                    }}
                                    className="flex items-center gap-1 text-[9px] text-amber-400 hover:text-amber-300 mt-1"
                                  >
                                    <GitBranch className="h-3 w-3" /> {t("flowRecorder.convertToCondition", "Convert to condition")}
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {!conditionForm && (
              <button
                type="button"
                onClick={() => setConditionForm({ index: -1, label: "", branches: ["", ""] })}
                className="flex items-center gap-1 text-[10px] text-amber-400 hover:text-amber-300 font-medium"
              >
                <GitBranch className="h-3 w-3" /> {t("flowRecorder.addCondition", "Add condition step")}
              </button>
            )}

            {conditionForm && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/05 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-amber-400">◇</span>
                  <span className="text-xs font-semibold text-amber-400">
                    {t("flowRecorder.newConditionTitle", "Nova Condição")}
                  </span>
                </div>

                <input
                  placeholder={t("flowRecorder.conditionPlaceholderExample", "se o usuário for menor de idade...")}
                  value={conditionForm.label}
                  onChange={(e) => setConditionForm({ ...conditionForm, label: e.target.value })}
                  className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm"
                  autoFocus
                />

                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
                    {t("flowRecorder.branches", "Branches")}
                  </p>
                  {conditionForm.branches.map((b, bi) => (
                    <div key={bi} className="flex items-center gap-2">
                      <div
                        className="w-1 h-6 rounded-full shrink-0"
                        style={{ backgroundColor: getBranchColor(bi) }}
                      />
                      <input
                        value={b}
                        onChange={(e) => {
                          const nb = [...conditionForm.branches];
                          nb[bi] = e.target.value;
                          setConditionForm({ ...conditionForm, branches: nb });
                        }}
                        placeholder={t("flowRecorder.branchOptionPlaceholder", { n: bi + 1, defaultValue: `Opção ${bi + 1}` })}
                        className="flex-1 rounded border border-border bg-secondary px-2 py-1 text-sm"
                      />
                      {conditionForm.branches.length > 2 && (
                        <button
                          type="button"
                          onClick={() =>
                            setConditionForm({
                              ...conditionForm,
                              branches: conditionForm.branches.filter((_, j) => j !== bi),
                            })
                          }
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setConditionForm({ ...conditionForm, branches: [...conditionForm.branches, ""] })}
                    className="text-[11px] text-primary hover:underline"
                  >
                    + {t("flowRecorder.addBranchOption", "Adicionar opção")}
                  </button>
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={cancelConditionDialog}
                    className="flex-1 rounded border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                  >
                    {t("flowRecorder.cancel")}
                  </button>
                  <button
                    type="button"
                    onClick={handleConditionFormSubmit}
                    disabled={!conditionForm.label.trim() || conditionForm.branches.some((b) => !b.trim())}
                    className="flex-1 rounded bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground disabled:opacity-50"
                  >
                    {t("flowRecorder.createCondition", "Criar")}
                  </button>
                </div>
              </div>
            )}

            {recordingSteps.length > 0 && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{t("flowRecorder.mermaid")}</p>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard.writeText(mermaidPreview);
                      setCopiedMermaid(true);
                      setTimeout(() => setCopiedMermaid(false), 2000);
                    }}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                    title={t("flowRecorder.copyMermaidTitle")}
                  >
                    {copiedMermaid ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Copy className="h-3.5 w-3.5" />}
                  </button>
                </div>
                <pre className="rounded-md border border-border bg-secondary p-2 text-[10px] font-mono text-muted-foreground whitespace-pre-wrap overflow-auto max-h-32">
                  {mermaidPreview}
                </pre>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-3 border-t border-border flex gap-2 shrink-0">
        <button
          type="button"
          onClick={handleFinalize}
          className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          {t("flowRecorder.finalize")}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md transition-colors"
        >
          {t("flowRecorder.cancel")}
        </button>
      </div>
    </div>
  );
};

export default FlowRecorderPanel;
