import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useReactFlow } from "@xyflow/react";
import {
  X,
  Plus,
  Play,
  Trash2,
  Pencil,
  Copy,
  Check,
  Layers,
  FileInput,
  ChevronDown,
  ChevronRight,
} from "lucide-react";
import { useFlowMode } from "@/features/canvas/flow/FlowModeContext";
import { layoutScopedNodes } from "@/features/canvas/layout/layoutScopedNodes";
import { useCanvasSelectionStore } from "@/features/canvas/hooks/useCanvasSelectionStore";
import {
  useFlows,
  useDiagramActions,
  useActiveDiagramId,
  useActiveDiagram,
  useComponents,
  useConnections,
  useDiagramStore,
  useResolvedNodeLayouts,
  resolveActiveScene,
  getStepCount,
  getFlowParticipants,
  repairFlow,
  buildFlowDuplicatePatch,
  stepsToMermaid,
  parseMermaidFlowchart,
  parseMermaidSequence,
} from "@/features/diagram";
import type { Flow } from "@/features/diagram";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import MermaidImportDialog from "./MermaidImportDialog";
import { FlowScriptPanel } from "./script/FlowScriptPanel";
import { useFlowViewStore } from "./useFlowViewStore";
import { validateFlow, type BrokenStep } from "./validateFlow";
import BrokenFlowDialog from "./BrokenFlowDialog";

interface Props {
  onClose: () => void;
  onPlay: (flow: Flow) => void;
  onStartRecording: () => void;
  onEditFlow: (flow: Flow) => void;
  panelActionsLocked?: boolean;
  panelActionsLockedTitle?: string;
  onGetInsertPosition: () => { x: number; y: number };
}

const FlowPanel = ({
  onClose,
  onPlay,
  onStartRecording,
  onEditFlow,
  panelActionsLocked = false,
  panelActionsLockedTitle,
  onGetInsertPosition,
}: Props) => {
  const { t } = useTranslation();
  const { isIdle } = useFlowMode();
  const flowOrCompareLocked = !isIdle || panelActionsLocked;
  const flows = useFlows();
  const diagram = useActiveDiagram();
  const activeDiagramId = useActiveDiagramId();
  const components = useComponents();
  const connections = useConnections();
  const resolvedNodeLayouts = useResolvedNodeLayouts();
  const { removeFlow, addFlow, updateFlow, applyAutoLayout } = useDiagramActions();
  const importMermaidSequenceResult = useDiagramStore((state) => state.importMermaidSequenceResult);
  const importDrawioResult = useDiagramStore((state) => state.importDrawioResult);
  const reactFlowInstance = useReactFlow();
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [pendingPlay, setPendingPlay] = useState<{ flow: Flow; broken: BrokenStep[] } | null>(null);
  const [showMermaidImport, setShowMermaidImport] = useState(false);
  const scriptFlowId = useFlowViewStore((state) => state.scriptFlowId);
  const openScript = useFlowViewStore((state) => state.openScript);

  const layoutNewNodes = useCallback(
    async (nodeIds: string[], connectionIds: string[]) => {
      const applied = await layoutScopedNodes({
        nodeIds,
        connectionIds,
        components,
        connections,
        nodeLayouts: resolvedNodeLayouts,
        anchor: onGetInsertPosition(),
        activeDiagramId,
        applyAutoLayout,
      });
      if (!applied) return;

      requestAnimationFrame(() => {
        reactFlowInstance.fitView({ duration: 400, padding: 0.2 });
      });
    },
    [
      components,
      connections,
      resolvedNodeLayouts,
      applyAutoLayout,
      activeDiagramId,
      onGetInsertPosition,
      reactFlowInstance,
    ],
  );

  const preselectAfterImport = useCallback(
    (nodeIds: string[], _connectionIds: string[]) => {
      if (nodeIds.length === 0) return;
      const store = useCanvasSelectionStore.getState();
      store.setSelectedNodeId(nodeIds[0] ?? null);
      store.setSelectedNodeIds(new Set(nodeIds));
      store.setSelectedEdgeId(null);
      void layoutNewNodes(nodeIds, _connectionIds).catch((err) => {
        console.error("[mermaidImport] scoped auto-layout failed", err);
        toast.error(t("flows.importDialog.layoutError"));
      });
    },
    [layoutNewNodes, t],
  );

  /**
   * The scene in view, if any. Flows live in the base model, so any repair the
   * broken-flow dialog offers would edit the base from inside a scene — the
   * dialog refuses it and says so rather than doing it quietly.
   */
  const activeScene = diagram ? resolveActiveScene(diagram) : null;
  const sceneInView = activeScene ? { name: activeScene.name } : undefined;

  const handlePlayWithValidation = (flow: Flow) => {
    if (!diagram) {
      onPlay(flow);
      return;
    }
    const broken = validateFlow(flow, diagram);
    if (broken.length > 0) {
      setPendingPlay({ flow, broken });
    } else {
      onPlay(flow);
    }
  };

  const handleRemoveBrokenAndPlay = (stepIds: string[]) => {
    if (!pendingPlay) return;
    const { steps, entryStepId } = repairFlow(pendingPlay.flow, stepIds);
    updateFlow(pendingPlay.flow.id, { steps, entryStepId });
    onPlay({ ...pendingPlay.flow, steps, entryStepId });
    setPendingPlay(null);
  };

  const allTags = [...new Set(flows.flatMap((f) => f.tags ?? []))];
  const filtered = tagFilter ? flows.filter((f) => f.tags?.includes(tagFilter)) : flows;

  const handleCopy = (flow: Flow) => {
    navigator.clipboard.writeText(stepsToMermaid(flow, components, connections));
    setCopiedId(flow.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleDuplicate = (flow: Flow) => {
    if (!activeDiagramId) return;
    const patch = buildFlowDuplicatePatch(flow, t("flowPanel.copyPrefix", { name: flow.name }));
    const newFlow = addFlow(activeDiagramId, patch.name, patch.mermaid, patch.steps);
    if (!newFlow) return;
    if (patch.description || patch.tags?.length) {
      updateFlow(newFlow.id, {
        description: patch.description,
        tags: patch.tags,
        entryStepId: patch.entryStepId,
      });
    }
  };

  const handleMermaidImport = useCallback(
    (text: string, flowName: string) => {
      if (!activeDiagramId) return;
      const anchor = onGetInsertPosition();
      const plan = parseMermaidSequence(text, components, connections, anchor);
      if (!plan.entryStepId) return;

      const flowId = importMermaidSequenceResult(
        plan.newComponents,
        plan.newConnections,
        plan.steps,
        plan.entryStepId,
        flowName,
        plan.layouts,
      );
      if (flowId) {
        const nodeIds = plan.newComponents.map((c) => c.id);
        const connectionIds = plan.newConnections.map((c) => c.id);
        preselectAfterImport(nodeIds, connectionIds);
      }
      setShowMermaidImport(false);
    },
    [
      activeDiagramId,
      components,
      connections,
      importMermaidSequenceResult,
      onGetInsertPosition,
      preselectAfterImport,
    ],
  );

  const handleMermaidFlowchartImport = useCallback(
    (text: string, _flowName: string) => {
      if (!activeDiagramId) return;
      const anchor = onGetInsertPosition();
      const plan = parseMermaidFlowchart(text, components, connections, anchor);
      if (plan.newComponents.length === 0 && plan.errors.length > 0) return;

      const createdIds = importDrawioResult(plan.newComponents, plan.newConnections, plan.layouts);
      if (createdIds.length > 0) {
        const connectionIds = plan.newConnections.map((c) => c.id);
        preselectAfterImport(createdIds, connectionIds);
      }
      setShowMermaidImport(false);
    },
    [
      activeDiagramId,
      components,
      connections,
      importDrawioResult,
      onGetInsertPosition,
      preselectAfterImport,
    ],
  );

  return (
    <div className="absolute right-0 top-0 bottom-0 z-20 w-80 border-l border-border bg-card overflow-hidden flex flex-col">
      <div className="flex items-center justify-between p-3 border-b border-border gap-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {t("flows.panelTitle")}
        </h3>
        <div className="flex items-center gap-1.5">
          <Button
            variant="default"
            size="sm"
            onClick={() => setShowMermaidImport(true)}
            disabled={flowOrCompareLocked}
            title={flowOrCompareLocked ? panelActionsLockedTitle : t("flows.importFlow")}
            className="h-7 gap-1.5 px-2.5 text-xs font-medium"
          >
            <FileInput className="h-3.5 w-3.5" />
            {t("flows.importFlow")}
          </Button>
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
            <div
              key={flow.id}
              className="rounded-lg border border-border p-2.5 transition-colors hover:bg-surface-hover"
            >
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => openScript(scriptFlowId === flow.id ? null : flow.id)}
                  title={t("flowScript.openScript")}
                  className="shrink-0 text-muted-foreground transition-colors hover:text-foreground"
                >
                  {scriptFlowId === flow.id ? (
                    <ChevronDown className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronRight className="h-3.5 w-3.5" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground truncate">{flow.name}</p>
                  {flow.description && (
                    <p className="text-[10px] text-muted-foreground italic truncate mt-0.5">
                      "{flow.description}"
                    </p>
                  )}
                  <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">
                      {t("flowPanel.stepsCount", { count: stepCount })}
                    </span>
                    {componentIds.size > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {t("flowPanel.participantsCount", { count: componentIds.size })}
                      </span>
                    )}
                    {flow.tags?.map((tag) => (
                      <span
                        key={tag}
                        className="text-[9px] rounded-full bg-secondary px-1.5 py-0.5 text-secondary-foreground"
                      >
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
                    title={
                      flowOrCompareLocked ? panelActionsLockedTitle : t("flows.duplicateTitle")
                    }
                  >
                    <Layers className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={flowOrCompareLocked}
                    onClick={() => handleCopy(flow)}
                    className="text-muted-foreground hover:text-foreground transition-colors disabled:opacity-40 disabled:pointer-events-none"
                    title={
                      flowOrCompareLocked ? panelActionsLockedTitle : t("flows.copyMermaidTitle")
                    }
                  >
                    {copiedId === flow.id ? (
                      <Check className="h-3.5 w-3.5 text-emerald-500" />
                    ) : (
                      <Copy className="h-3.5 w-3.5" />
                    )}
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
              {scriptFlowId === flow.id && (
                <div className="mt-2 border-t border-border pt-2">
                  <FlowScriptPanel flow={flow} />
                </div>
              )}
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
          sceneInView={sceneInView}
          onCancel={() => setPendingPlay(null)}
          onRemoveSteps={(stepIds) => handleRemoveBrokenAndPlay(stepIds)}
        />
      )}
      <MermaidImportDialog
        open={showMermaidImport}
        onOpenChange={setShowMermaidImport}
        onImport={handleMermaidImport}
        onImportFlowchart={handleMermaidFlowchartImport}
      />
    </div>
  );
};

export default FlowPanel;
