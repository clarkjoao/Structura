import { useEffect, useState, type DragEvent, type MouseEvent } from "react";
import { useTranslation } from "react-i18next";
import type { FlowStep } from "@/features/diagram";
import { isConditionStep, isFlowLinkStep, useActiveDiagram, useDiagrams } from "@/features/diagram";
import { X, GripVertical } from "lucide-react";

export interface StepItemProps {
  step: FlowStep;
  index: number;
  isLast: boolean;
  isExpanded: boolean;
  isBranchStep: boolean;
  /** Row highlighted when this step is chosen on the flow map. */
  isSelectedFromMap?: boolean;
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
  getStepLabel: (step: FlowStep) => string;
  editingFlowId: string | null;
  /** True when this step is a leaf in the preview flow graph (can attach a flow link). */
  isFlowGraphLeaf: boolean;
  onSetFlowLink: (
    stepId: string,
    target: {
      targetFlowId: string;
      targetFlowName: string;
      targetDiagramId: string;
      targetDiagramName: string;
    },
  ) => void;
  onRemoveFlowLink: (stepId: string) => void;
}

export function StepItem({
  step,
  index,
  isLast,
  isExpanded,
  isBranchStep,
  isSelectedFromMap = false,
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
  getStepLabel,
  editingFlowId,
  isFlowGraphLeaf,
  onSetFlowLink,
  onRemoveFlowLink,
}: StepItemProps) {
  const { t } = useTranslation();
  const diagrams = useDiagrams();
  const activeDiagram = useActiveDiagram();
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

  return (
    <div data-step-id={step.id}>
      <div
        draggable
        onDragStart={(e) => onDragStart(e, index)}
        onDragOver={(e) => onDragOver(e, index)}
        onDrop={(e) => onDrop(e, index)}
        onDragEnd={onDragEnd}
        onClick={onToggleExpand}
        className={`group flex items-center gap-1 rounded-md px-1.5 py-1.5 text-xs cursor-pointer hover:bg-secondary/50 transition-colors ${
          isLast ? "bg-primary/10 text-primary" : "text-foreground"
        } ${isConditionStep(step) ? "border-l-2 border-amber-400" : ""} ${
          isFlowLinkStep(step) ? "border-l-2 border-amber-500/80" : ""
        } ${isBranchStep ? "ml-3 border-l border-amber-400/30" : ""} ${
          isDragging ? "opacity-40" : ""
        } ${
          isDragOver ? "ring-1 ring-primary/50" : ""
        } ${isSelectedFromMap ? "ring-1 ring-primary/40 bg-primary/5" : ""}`}
      >
        <GripVertical className="h-3 w-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 cursor-grab transition-opacity" />
        <span className="text-[10px] text-muted-foreground shrink-0">{isExpanded ? "▾" : "▸"}</span>
        <span className="font-mono text-[10px] text-muted-foreground w-4 text-right shrink-0">{index + 1}.</span>
        <span className="truncate flex-1">{getStepLabel(step)}</span>
        {"duration" in step && step.duration ? (
          <span className="text-[9px] font-mono text-primary/70 shrink-0">{step.duration}</span>
        ) : null}
        {"isAsync" in step && step.isAsync ? (
          <span className="text-[9px] font-mono text-amber-400 shrink-0">async</span>
        ) : null}
        {"handleId" in step && step.handleId ? (
          <span className="text-[9px] font-mono text-muted-foreground shrink-0">[{step.handleId}]</span>
        ) : null}
        <button
          type="button"
          onClick={onDelete}
          className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all"
          title={t("flowRecorder.removeStepTitle")}
        >
          <X className="h-3 w-3" />
        </button>
      </div>
      {isExpanded && !isConditionStep(step) && (
        <div className="pl-7 pr-2 pb-1 pt-0.5 space-y-1">
          {isFlowLinkStep(step) ? (
            <>
              <div className="rounded-md border border-amber-500/35 bg-amber-500/10 px-2 py-2 space-y-1">
                <p className="text-[10px] font-semibold text-amber-600 dark:text-amber-400 truncate">
                  ↗ {step.targetFlowName}
                </p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {step.targetDiagramName}
                </p>
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
              {"connectionId" in step && step.connectionId && (
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
                      {t("common.asyncMessage")}
                    </label>
                  </div>
                </>
              )}
              {isFlowGraphLeaf && (
                <div
                  className="pt-2 mt-1 border-t border-border space-y-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <p className="text-[9px] text-muted-foreground font-semibold uppercase tracking-wide">
                    {t("flowLink.sectionTitle")}
                  </p>

                  <label className="block space-y-1">
                    <span className="text-[9px] text-muted-foreground">{t("flowLink.diagramLabel")}</span>
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
                    <span className="text-[9px] text-muted-foreground">{t("flowLink.flowLabel")}</span>
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

                  <div className="flex gap-2">
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
                      className="flex-1 rounded-md bg-amber-500 px-2 py-1.5 text-[10px] font-semibold text-amber-950 hover:bg-amber-500/90 disabled:opacity-50"
                    >
                      {t("flowLink.linkButton")}
                    </button>
                    <button
                      type="button"
                      disabled={!isFlowLinkStep(step)}
                      onClick={() => onRemoveFlowLink(step.id)}
                      className="flex-1 rounded-md border border-border bg-card px-2 py-1.5 text-[10px] font-medium text-muted-foreground hover:text-foreground disabled:opacity-50"
                    >
                      {t("flowLink.removeButton")}
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
