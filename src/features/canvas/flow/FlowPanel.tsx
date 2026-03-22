import { useState } from "react";
import { useTranslation } from "react-i18next";
import { X, Plus, Play, Trash2, Pencil, Copy, Check, Layers, BarChart2 } from "lucide-react";
import { useFlowMode } from "@/features/canvas/flow/FlowModeContext";
import { useFlows, useDiagramActions, useActiveDiagramId, useActiveDiagram, getStepCount, getFlowParticipants } from "@/features/diagram";
import type { Flow, FlowStep } from "@/features/diagram";
import { validateFlow, type BrokenStep } from "./validateFlow";
import BrokenFlowDialog from "./BrokenFlowDialog";

interface Props {
  onClose: () => void;
  onPlay: (flow: Flow) => void;
  onStartRecording: () => void;
  onEditFlow: (flow: Flow) => void;
  isViewingCoverage?: boolean;
  onToggleCoverage?: () => void;
  /** True when canvas is in comparison mode — same actions blocked as during play/record on the panel. */
  panelActionsLocked?: boolean;
  panelActionsLockedTitle?: string;
}

const FlowPanel = ({
  onClose,
  onPlay,
  onStartRecording,
  onEditFlow,
  isViewingCoverage,
  onToggleCoverage,
  panelActionsLocked = false,
  panelActionsLockedTitle,
}: Props) => {
  const { t } = useTranslation();
  const { isIdle } = useFlowMode();
  const flowOrCompareLocked = !isIdle || panelActionsLocked;
  const flows = useFlows();
  const diagram = useActiveDiagram();
  const activeDiagramId = useActiveDiagramId();
  const { removeFlow, addFlow, updateFlow } = useDiagramActions();
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingPlay, setPendingPlay] = useState<{ flow: Flow; broken: BrokenStep[] } | null>(null);

  const handlePlayWithValidation = (flow: Flow) => {
    if (!diagram) { onPlay(flow); return; }
    const broken = validateFlow(flow, diagram);
    if (broken.length > 0) {
      setPendingPlay({ flow, broken });
    } else {
      onPlay(flow);
    }
  };

  const handleRemoveBrokenAndPlay = (stepIds: string[]) => {
    if (!pendingPlay) return;
    const idSet = new Set(stepIds);
    const newSteps: Record<string, FlowStep> = {};
    for (const [id, step] of Object.entries(pendingPlay.flow.steps)) {
      if (idSet.has(id)) continue;
      newSteps[id] = {
        ...step,
        branches: step.branches?.map((b) => ({ ...b })),
      };
    }
    for (const id of Object.keys(newSteps)) {
      const s = newSteps[id];
      const next = s.next && idSet.has(s.next) ? undefined : s.next;
      const branches = s.branches?.filter((b) => !idSet.has(b.nextId));
      if (next !== s.next || branches !== s.branches) {
        newSteps[id] = { ...s, next, branches };
      }
    }
    let entryStepId = pendingPlay.flow.entryStepId;
    if (entryStepId && idSet.has(entryStepId)) {
      entryStepId = Object.keys(newSteps)[0];
    }
    updateFlow(pendingPlay.flow.id, { steps: newSteps, entryStepId });
    onPlay({ ...pendingPlay.flow, steps: newSteps, entryStepId });
    setPendingPlay(null);
  };

  const allTags = [...new Set(flows.flatMap((f) => f.tags ?? []))];
  const filtered = tagFilter ? flows.filter((f) => f.tags?.includes(tagFilter)) : flows;

  const handleCopy = (flow: Flow) => {
    navigator.clipboard.writeText(flow.mermaid);
    setCopiedId(flow.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDuplicate = (flow: Flow) => {
    if (!activeDiagramId) return;
    const newFlow = addFlow(activeDiagramId, t("flowPanel.copyPrefix", { name: flow.name }), flow.mermaid, flow.steps);
    if (flow.description || flow.tags?.length) {
      updateFlow(newFlow.id, { description: flow.description, tags: flow.tags, entryStepId: flow.entryStepId });
    }
  };

  return (
    <div className="w-80 h-full min-h-0 border-l border-border bg-card overflow-hidden flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t("flows.panelTitle")}
        </h3>
        <div className="flex items-center gap-1.5">
          {onToggleCoverage && (
            <button
              type="button"
              disabled={flowOrCompareLocked}
              onClick={onToggleCoverage}
              title={flowOrCompareLocked ? panelActionsLockedTitle : t("flows.coverageTitle")}
              className={`text-xs rounded-md px-2 py-0.5 font-medium transition-colors flex items-center gap-1 disabled:opacity-40 disabled:pointer-events-none ${isViewingCoverage ? "bg-emerald-500/20 text-emerald-400" : "text-muted-foreground hover:text-foreground"}`}
            >
              <BarChart2 className="h-3.5 w-3.5" /> {t("flowPanel.coverage")}
            </button>
          )}
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {allTags.length > 0 && (
        <div className="px-3 pt-2 flex flex-wrap gap-1">
          <button
            type="button"
            disabled={flowOrCompareLocked}
            onClick={() => setTagFilter(null)}
            className={`text-[9px] rounded-full px-2 py-0.5 font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none ${
              tagFilter === null
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
            }`}
          >
            {t("common.all")}
          </button>
          {allTags.map((tag) => (
            <button
              type="button"
              key={tag}
              disabled={flowOrCompareLocked}
              onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
              className={`text-[9px] rounded-full px-2 py-0.5 font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none ${
                tagFilter === tag
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-secondary/80"
              }`}
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      <div className="p-3 space-y-2 flex-1 min-h-0 overflow-y-auto">
        {filtered.map((flow) => {
          const stepCount = getStepCount(flow);
          const { componentIds } = getFlowParticipants(flow);
          return (
            <div key={flow.id} className="rounded-lg border border-border p-2.5 hover:bg-surface-hover transition-colors">
              <div className="flex items-center gap-2">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{flow.name}</p>
                  {flow.description && (
                    <p className="text-[10px] text-muted-foreground italic truncate mt-0.5">"{flow.description}"</p>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">{t("flowPanel.stepsCount", { count: stepCount })}</span>
                    {componentIds.size > 0 && (
                      <span className="text-[10px] text-muted-foreground">{t("flowPanel.participantsCount", { count: componentIds.size })}</span>
                    )}
                    {flow.tags?.map((tag) => (
                      <span key={tag} className="text-[9px] rounded-full bg-secondary px-1.5 py-0.5 text-secondary-foreground">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    disabled={flowOrCompareLocked}
                    onClick={() => handleDuplicate(flow)}
                    className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    title={flowOrCompareLocked ? panelActionsLockedTitle : t("flows.duplicateTitle")}
                  >
                    <Layers className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={flowOrCompareLocked}
                    onClick={() => handleCopy(flow)}
                    className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    title={flowOrCompareLocked ? panelActionsLockedTitle : t("flows.copyMermaidTitle")}
                  >
                    {copiedId === flow.id
                      ? <Check className="h-3.5 w-3.5 text-emerald-500" />
                      : <Copy className="h-3.5 w-3.5" />}
                  </button>
                  <button
                    type="button"
                    disabled={flowOrCompareLocked}
                    onClick={() => onEditFlow(flow)}
                    className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    title={flowOrCompareLocked ? panelActionsLockedTitle : t("flows.editTitle")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={flowOrCompareLocked}
                    onClick={() => handlePlayWithValidation(flow)}
                    className="text-primary hover:text-primary/80 transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    title={flowOrCompareLocked ? panelActionsLockedTitle : t("flows.playTitle")}
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={flowOrCompareLocked}
                    onClick={() => removeFlow(flow.id)}
                    className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    title={flowOrCompareLocked ? panelActionsLockedTitle : t("flows.removeTitle")}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <p className="text-xs text-muted-foreground italic text-center py-4">
            {tagFilter ? t("flows.emptyTagged") : t("flows.emptyNone")}
          </p>
        )}

        <button
          type="button"
          disabled={flowOrCompareLocked}
          onClick={onStartRecording}
          title={flowOrCompareLocked ? panelActionsLockedTitle : undefined}
          className="flex items-center gap-1.5 w-full justify-center rounded-md border border-dashed border-border px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/20 transition-all disabled:opacity-40 disabled:pointer-events-none"
        >
          <Plus className="h-3.5 w-3.5" /> {t("flowPanel.newFlow")}
        </button>
      </div>

      {pendingPlay && (
        <BrokenFlowDialog
          flow={pendingPlay.flow}
          brokenSteps={pendingPlay.broken}
          onCancel={() => setPendingPlay(null)}
          onRemoveSteps={(stepIds) => handleRemoveBrokenAndPlay(stepIds)}
        />
      )}
    </div>
  );
};

export default FlowPanel;
