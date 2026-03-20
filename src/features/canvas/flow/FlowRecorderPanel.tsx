import { useState, useCallback, useMemo } from "react";
import { useComponents, useConnections, stepsToMermaid } from "@/features/diagram";
import type { FlowStep } from "@/features/diagram";
import { X, GripVertical, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

interface Props {
  name: string;
  onNameChange: (name: string) => void;
  description: string;
  onDescriptionChange: (desc: string) => void;
  tags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (index: number) => void;
  steps: FlowStep[];
  onCancel: () => void;
  onFinalize: () => void;
  onUpdateStepDescription: (index: number, description: string) => void;
  onUpdateStepDuration: (index: number, duration: string) => void;
  onUpdateStepPayload: (index: number, payload: string) => void;
  onUpdateStepPayloadDirection: (index: number, direction: 'request' | 'response') => void;
  onDeleteStep: (index: number) => void;
  onReorderSteps: (fromIndex: number, toIndex: number) => void;
  isEditing?: boolean;
}

const FlowRecorderPanel = ({
  name,
  onNameChange,
  description,
  onDescriptionChange,
  tags,
  onAddTag,
  onRemoveTag,
  steps,
  onCancel,
  onFinalize,
  onUpdateStepDescription,
  onUpdateStepDuration,
  onUpdateStepPayload,
  onUpdateStepPayloadDirection,
  onDeleteStep,
  onReorderSteps,
  isEditing,
}: Props) => {
  const { t } = useTranslation();
  const components = useComponents();
  const connections = useConnections();
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [overIdx, setOverIdx] = useState<number | null>(null);
  const [copiedMermaid, setCopiedMermaid] = useState(false);

  const participants = useMemo(() => {
    return [...new Set(
      steps
        .map((s) => (s.componentId ? components[s.componentId]?.name : null))
        .filter(Boolean) as string[],
    )];
  }, [steps, components]);

  const getStepLabel = useCallback(
    (step: FlowStep): string => {
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
    if (steps.length === 0) toast.warning(t("flowRecorder.noStepsWarning"));
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

  const mermaidPreview = stepsToMermaid(steps, components, connections);

  return (
    <div className="w-80 h-full min-h-0 border-l border-border bg-card overflow-hidden flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border">
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

      <div className="p-3 space-y-3 flex-1 min-h-0 overflow-y-auto">
        <input
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          placeholder={t("flowRecorder.namePlaceholder")}
          className="w-full rounded-md border border-border bg-secondary px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          autoFocus
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
                <button onClick={() => onRemoveTag(i)} className="hover:text-destructive ml-0.5">×</button>
              </span>
            ))}
          </div>
          <input
            placeholder={t("flowRecorder.tagPlaceholder")}
            className="w-full rounded border border-border bg-secondary px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
            onKeyDown={handleTagKey}
          />
        </div>

        {participants.length > 0 && (
          <p className="text-[10px] text-muted-foreground">
            👥 {participants.join(", ")}
          </p>
        )}

        <div className="space-y-1">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">
            {t("flowRecorder.stepsHeading", { count: steps.length })}
          </p>
          {steps.length === 0 ? (
            <p className="text-xs text-muted-foreground italic py-2">
              {t("flowRecorder.recordHint")}
            </p>
          ) : (
            <div className="space-y-0.5 max-h-48 overflow-auto">
              {steps.map((step, i) => (
                <div key={`${step.order}-${step.componentId ?? step.connectionId}-${i}`}>
                  <div
                    draggable
                    onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; setDragIdx(i); }}
                    onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragIdx !== null) setOverIdx(i); }}
                    onDrop={(e) => { e.preventDefault(); if (dragIdx !== null && dragIdx !== i) onReorderSteps(dragIdx, i); setDragIdx(null); setOverIdx(null); }}
                    onDragEnd={() => { setDragIdx(null); setOverIdx(null); }}
                    onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                    className={`group flex items-center gap-1 rounded-md px-1.5 py-1.5 text-xs cursor-pointer hover:bg-secondary/50 transition-colors ${
                      i === steps.length - 1 ? "bg-primary/10 text-primary" : "text-foreground"
                    } ${dragIdx === i ? "opacity-40" : ""} ${
                      overIdx === i && dragIdx !== null && dragIdx !== i ? "ring-1 ring-primary/50" : ""
                    }`}
                  >
                    <GripVertical className="h-3 w-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 cursor-grab transition-opacity" />
                    <span className="text-[10px] text-muted-foreground shrink-0">{expandedStep === i ? "▾" : "▸"}</span>
                    <span className="font-mono text-[10px] text-muted-foreground w-4 text-right shrink-0">{i + 1}.</span>
                    <span className="truncate flex-1">{getStepLabel(step)}</span>
                    {step.duration && <span className="text-[9px] font-mono text-primary/70 shrink-0">{step.duration}</span>}
                    {step.handleId && <span className="text-[9px] font-mono text-muted-foreground shrink-0">[{step.handleId}]</span>}
                    <button onClick={(e) => handleDelete(i, e)} className="shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all" title={t("flowRecorder.removeStepTitle")}>
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  {expandedStep === i && (
                    <div className="pl-7 pr-2 pb-1 pt-0.5 space-y-1">
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
                                onClick={() => onUpdateStepPayloadDirection(i, 'request')}
                                className={`px-2 py-0.5 text-[9px] font-medium transition-colors ${
                                  (step.payloadDirection ?? 'request') === 'request'
                                    ? 'bg-cyan-500/20 text-cyan-400'
                                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {t("flowRecorder.request")}
                              </button>
                              <button
                                type="button"
                                onClick={() => onUpdateStepPayloadDirection(i, 'response')}
                                className={`px-2 py-0.5 text-[9px] font-medium transition-colors ${
                                  step.payloadDirection === 'response'
                                    ? 'bg-emerald-500/20 text-emerald-400'
                                    : 'bg-secondary text-muted-foreground hover:text-foreground'
                                }`}
                              >
                                {t("flowRecorder.response")}
                              </button>
                            </div>
                          </div>
                          <div className="flex items-start gap-1">
                            <span className="text-[10px] mt-1 shrink-0">{step.payloadDirection === 'response' ? '📥' : '📤'}</span>
                            <textarea
                              value={step.payload ?? ""}
                              onChange={(e) => onUpdateStepPayload(i, e.target.value)}
                              placeholder={t("flowRecorder.payloadPlaceholder")}
                              rows={2}
                              className="w-full rounded border border-border bg-secondary px-2 py-1 text-[10px] font-mono text-foreground focus:outline-none focus:ring-1 focus:ring-ring resize-y"
                              onClick={(e) => e.stopPropagation()}
                            />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {steps.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">{t("flowRecorder.mermaid")}</p>
              <button
                type="button"
                onClick={() => { navigator.clipboard.writeText(mermaidPreview); setCopiedMermaid(true); setTimeout(() => setCopiedMermaid(false), 2000); }}
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

      <div className="p-3 border-t border-border flex gap-2">
        <button onClick={handleFinalize} className="flex-1 rounded-md bg-primary px-3 py-2 text-xs font-semibold text-primary-foreground hover:bg-primary/90 transition-colors">
          {t("flowRecorder.finalize")}
        </button>
        <button onClick={onCancel} className="px-3 py-2 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md transition-colors">
          {t("flowRecorder.cancel")}
        </button>
      </div>
    </div>
  );
};

export default FlowRecorderPanel;
