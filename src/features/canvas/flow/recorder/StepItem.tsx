import type { DragEvent, MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { FlowStep } from "@/features/diagram";
import { X, GripVertical, GitBranch } from "lucide-react";
import { getBranchColor } from "../branchColors";

export interface StepItemProps {
  step: FlowStep;
  index: number;
  isLast: boolean;
  isExpanded: boolean;
  isBranchStep: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  onToggleExpand: () => void;
  onDelete: (e: MouseEvent) => void;
  onDragStart: (e: DragEvent, index: number) => void;
  onDragOver: (e: DragEvent, index: number) => void;
  onDrop: (e: DragEvent, index: number) => void;
  onDragEnd: () => void;
  onUpdateDescription: (index: number, value: string) => void;
  onUpdateDuration: (index: number, value: string) => void;
  onUpdatePayload: (index: number, value: string) => void;
  onUpdatePayloadDirection: (index: number, direction: "request" | "response") => void;
  onUpdateIsAsync: (index: number, value: boolean) => void;
  onUpdateConditionLabel: (index: number, label: string) => void;
  onAddBranchLabel: (conditionStepId: string, label: string) => void;
  onRemoveBranchLabel: (conditionStepId: string, branchIndex: number) => void;
  onUpdateBranchLabel: (conditionStepId: string, branchIndex: number, label: string) => void;
  onOpenBranchSelect: (conditionStepId: string) => void;
  onConvertToCondition: (index: number) => void;
  getStepLabel: (step: FlowStep) => string;
}

export function StepItem({
  step,
  index,
  isLast,
  isExpanded,
  isBranchStep,
  isDragging,
  isDragOver,
  onToggleExpand,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onUpdateDescription,
  onUpdateDuration,
  onUpdatePayload,
  onUpdatePayloadDirection,
  onUpdateIsAsync,
  onUpdateConditionLabel,
  onAddBranchLabel,
  onRemoveBranchLabel,
  onUpdateBranchLabel,
  onOpenBranchSelect,
  onConvertToCondition,
  getStepLabel,
}: StepItemProps) {
  const { t } = useTranslation();

  return (
    <div>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, index)}
        onDragOver={(e) => onDragOver(e, index)}
        onDrop={(e) => onDrop(e, index)}
        onDragEnd={onDragEnd}
        onClick={onToggleExpand}
        className={`group flex items-center gap-1 rounded-md px-1.5 py-1.5 text-xs cursor-pointer hover:bg-secondary/50 transition-colors ${
          isLast ? "bg-primary/10 text-primary" : "text-foreground"
        } ${step.type === "condition" ? "border-l-2 border-amber-400" : ""} ${
          isBranchStep ? "ml-3 border-l border-amber-400/30" : ""
        } ${isDragging ? "opacity-40" : ""} ${
          isDragOver ? "ring-1 ring-primary/50" : ""
        }`}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 cursor-grab transition-opacity" />
        <span className="text-[10px] text-muted-foreground shrink-0">{isExpanded ? "▾" : "▸"}</span>
        <span className="font-mono text-[10px] text-muted-foreground w-4 text-right shrink-0">{index + 1}.</span>
        <span className="truncate flex-1">{getStepLabel(step)}</span>
        {step.duration && <span className="text-[9px] font-mono text-primary/70 shrink-0">{step.duration}</span>}
        {step.isAsync && <span className="text-[9px] font-mono text-amber-400 shrink-0">async</span>}
        {step.handleId && <span className="text-[9px] font-mono text-muted-foreground shrink-0">[{step.handleId}]</span>}
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
          title={t("flowRecorder.removeStepTitle")}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {isExpanded && (
        <div className="pl-7 pr-2 pb-1 pt-0.5 space-y-1">
          {step.type === "condition" ? (
            <>
              <div className="flex items-start gap-1">
                <span className="text-[10px] mt-1 shrink-0">◇</span>
                <input
                  value={step.conditionLabel ?? ""}
                  onChange={(e) => onUpdateConditionLabel(index, e.target.value)}
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
                  onChange={(e) => onUpdateDescription(index, e.target.value)}
                  placeholder={t("flowRecorder.stepDescPlaceholder")}
                  className="w-full rounded border border-border bg-secondary px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
              <div className="flex items-start gap-1">
                <span className="text-[10px] mt-1 shrink-0">⏱</span>
                <input
                  value={step.duration ?? ""}
                  onChange={(e) => onUpdateDuration(index, e.target.value)}
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
                        onClick={() => onUpdatePayloadDirection(index, "request")}
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
                        onClick={() => onUpdatePayloadDirection(index, "response")}
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
                    <span className="text-[10px] mt-1 shrink-0">
                      {step.payloadDirection === "response" ? "📥" : "📤"}
                    </span>
                    <textarea
                      value={step.payload ?? ""}
                      onChange={(e) => onUpdatePayload(index, e.target.value)}
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
                        onChange={(e) => onUpdateIsAsync(index, e.target.checked)}
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
                    onConvertToCondition(index);
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
}
