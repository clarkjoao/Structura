import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  GitBranch,
  Plus,
  Play,
  Trash2,
  Pencil,
  Copy,
  Circle,
  CircleDot,
  Layers,
  FileInput,
  MoreHorizontal,
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
  getCachedCanvasSnapshot,
  resolveActiveVersion,
  getStepCount,
  getFlowParticipants,
  repairFlow,
  buildFlowDuplicatePatch,
  stepsToMermaid,
  parseMermaidFlowchart,
  parseMermaidSequence,
} from "@/features/diagram";
import type { Flow } from "@/features/diagram";
import type { RecordingSpeed } from "./useFlowPlaybackRecorder";
import { toast } from "sonner";
import { isEditableTarget, KEY, keyIs } from "@/lib/core/keyboard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { PanelColumn } from "../panels/ElementPanel/shell/PanelFrame";
import { PanelHeader, type PanelMenuItem } from "../panels/ElementPanel/shell/PanelHeader";
import MermaidImportDialog from "./MermaidImportDialog";
import { useFlowViewStore } from "./useFlowViewStore";
import { useHighlightRequests } from "../focus/highlightRequests";
import { validateFlow, type BrokenStep } from "./validateFlow";
import BrokenFlowDialog from "./BrokenFlowDialog";
import {
  interactionOf,
  kindDerivedFlowIds,
  resolveKindPolicy,
} from "@/features/diagram-kinds/policy";
import { activeDirection } from "../hooks/useActiveDirection";
import type { DiagramDirection } from "@/features/diagram";
import { useFrameDiagram } from "../focus/frameDiagram";

const GIF_SPEEDS: { speed: RecordingSpeed; labelKey: string }[] = [
  { speed: "slow", labelKey: "flows.gifSpeedSlow" },
  { speed: "normal", labelKey: "flows.gifSpeedNormal" },
  { speed: "fast", labelKey: "flows.gifSpeedFast" },
];

interface Props {
  onClose: () => void;
  onPlay: (flow: Flow) => void;
  onStartRecording: () => void;
  onEditFlow: (flow: Flow) => void;
  onRecordGif?: (flow: Flow, speed: RecordingSpeed) => void;
  panelActionsLocked?: boolean;
  panelActionsLockedTitle?: string;
  onGetInsertPosition: () => { x: number; y: number };
}

/** A card shows a few tags; the rest are behind the filter above. */
const MAX_CARD_TAGS = 3;

const ROW_ACTION_CLASS =
  "rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:pointer-events-none disabled:opacity-40";

const FlowPanel = ({
  onClose,
  onPlay,
  onStartRecording,
  onEditFlow,
  onRecordGif,
  panelActionsLocked = false,
  panelActionsLockedTitle,
  onGetInsertPosition,
}: Props) => {
  const { t } = useTranslation();
  const { isIdle } = useFlowMode();
  const flowOrCompareLocked = !isIdle || panelActionsLocked;
  const activeForKind = useActiveDiagram();
  // A diagram kind that derives its flow (ADR-0014): no recording, and the derived flow is the
  // steps' — read and played here, its order changed on the canvas.
  const recordFlows = interactionOf(resolveKindPolicy(activeForKind)).recordFlows;
  const derivedFlowIds = kindDerivedFlowIds(activeForKind);
  const flows = useFlows();
  const diagram = useActiveDiagram();
  const activeDiagramId = useActiveDiagramId();
  const components = useComponents();
  const connections = useConnections();
  const { removeFlow, addFlow, updateFlow, applyAutoLayout } = useDiagramActions();
  const importMermaidSequenceResult = useDiagramStore((state) => state.importMermaidSequenceResult);
  const importDrawioResult = useDiagramStore((state) => state.importDrawioResult);
  const frameDiagram = useFrameDiagram();
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [pendingPlay, setPendingPlay] = useState<{ flow: Flow; broken: BrokenStep[] } | null>(null);
  const [showMermaidImport, setShowMermaidImport] = useState(false);
  const scriptFlowId = useFlowViewStore((state) => state.scriptFlowId);
  const openScript = useFlowViewStore((state) => state.openScript);

  // Escape closes the panel. The canvas stands down while it is open, so nothing
  // else handles the key; a dialog or menu opened from here dismisses itself
  // first and marks the event handled, and a focused field keeps it.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!keyIs(event, KEY.ESCAPE) || event.defaultPrevented) return;
      if (isEditableTarget(event.target)) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const layoutNewNodes = useCallback(
    async (
      nodeIds: string[],
      connectionIds: string[],
      direction?: { value: DiagramDirection; write: boolean },
    ) => {
      // Read at call time: this runs right after the import wrote the new
      // elements, and the hook values captured with this callback predate
      // them — the scoped layout found none of its ids and silently did nothing.
      const state = useDiagramStore.getState();
      const diagram = state.activeDiagramId ? state.diagrams[state.activeDiagramId] : undefined;
      if (!diagram) return;
      const resolved = getCachedCanvasSnapshot(diagram);
      const applied = await layoutScopedNodes({
        nodeIds,
        connectionIds,
        components: resolved.components,
        connections: resolved.connections,
        nodeLayouts: resolved.nodeLayouts,
        anchor: onGetInsertPosition(),
        activeDiagramId,
        applyAutoLayout,
        ...(direction && { direction: direction.value, writeDirection: direction.write }),
      });
      if (!applied) return;

      requestAnimationFrame(() => {
        void frameDiagram({ duration: 400, padding: 0.2 });
      });
    },
    [applyAutoLayout, activeDiagramId, onGetInsertPosition, frameDiagram],
  );

  const preselectAfterImport = useCallback(
    (
      nodeIds: string[],
      _connectionIds: string[],
      direction?: { value: DiagramDirection; write: boolean },
    ) => {
      if (nodeIds.length === 0) return;
      const store = useCanvasSelectionStore.getState();
      store.setSelectedNodeId(nodeIds[0] ?? null);
      store.setSelectedNodeIds(new Set(nodeIds));
      store.setSelectedEdgeId(null);
      void layoutNewNodes(nodeIds, _connectionIds, direction).catch((err) => {
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
  const activeVersion = diagram ? resolveActiveVersion(diagram) : null;
  const versionInView = activeVersion ? { name: activeVersion.name } : undefined;

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

  /**
   * Hovering a card lights what the flow passes through, so a list of names maps onto the
   * diagram before anything is opened. The camera stays put; a hover is not a navigation.
   */
  const requestHighlight = useHighlightRequests((state) => state.requestHighlight);
  const lit = useRef(false);
  const lightParticipants = useCallback(
    (componentIds: ReadonlySet<string>, connectionIds: ReadonlySet<string>) => {
      lit.current = true;
      requestHighlight({
        componentIds: [...componentIds],
        connectionIds: [...connectionIds],
        frame: false,
      });
    },
    [requestHighlight],
  );
  const unlightParticipants = useCallback(() => {
    if (!lit.current) return;
    lit.current = false;
    requestHighlight({});
  }, [requestHighlight]);
  // Closed under the pointer, the list would otherwise leave its last hover lit.
  useEffect(() => unlightParticipants, [unlightParticipants]);

  /**
   * The check that used to sit in place of the icon lived on a button that is
   * now inside a menu, and the menu closes on the click. The confirmation has
   * to outlive it, so it is said rather than shown.
   */
  const handleCopy = (flow: Flow) => {
    navigator.clipboard.writeText(stepsToMermaid(flow, components, connections));
    toast.success(t("flows.copiedMermaid"));
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

      // The header's direction is the diagram's when the import is the whole
      // diagram; into one with content, the import follows the diagram
      // (ADR-0013) — re-arranging the author's work is not an import's call.
      const wasEmpty = Object.keys(components).length === 0;
      const current = activeDirection();
      const target = wasEmpty ? plan.direction : current;
      if (plan.directionApproximated) {
        toast.info(t("flows.importDialog.directionApproximated"));
      } else if (target !== plan.direction) {
        toast.info(t("flows.importDialog.directionKept"));
      }

      const createdIds = importDrawioResult(plan.newComponents, plan.newConnections, plan.layouts);
      if (createdIds.length > 0) {
        const connectionIds = plan.newConnections.map((c) => c.id);
        preselectAfterImport(createdIds, connectionIds, {
          value: target,
          write: wasEmpty && target !== current,
        });
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
      t,
    ],
  );

  const menu: PanelMenuItem[] = flowOrCompareLocked
    ? []
    : [
        {
          key: "import",
          label: t("flows.importFlow"),
          icon: FileInput,
          onSelect: () => setShowMermaidImport(true),
        },
      ];

  return (
    <PanelColumn testId="flows-panel">
      <PanelHeader
        icon={<GitBranch className="h-3.5 w-3.5" />}
        typeLabel={t("flows.panelTitle")}
        name={t("flowPanel.listTitle", { count: flows.length })}
        namePlaceholder={t("flows.panelTitle")}
        menu={menu}
        onClose={onClose}
        subheader={
          <div className="space-y-2 px-1.5 pt-1">
            {recordFlows && (
              <Button
                size="sm"
                disabled={flowOrCompareLocked}
                onClick={onStartRecording}
                title={flowOrCompareLocked ? panelActionsLockedTitle : undefined}
                className="h-8 w-full gap-1.5"
              >
                <Plus className="h-4 w-4" /> {t("flowPanel.newFlow")}
              </Button>
            )}
            {allTags.length > 0 && (
              <div
                role="group"
                aria-label={t("flowPanel.filterByTag")}
                className="-mx-1.5 flex gap-1.5 overflow-x-auto px-1.5 pb-1 [scrollbar-width:thin]"
              >
                {[null, ...allTags].map((tag) => (
                  <button
                    type="button"
                    key={tag ?? "__all"}
                    disabled={flowOrCompareLocked}
                    aria-pressed={tagFilter === tag}
                    onClick={() => setTagFilter(tagFilter === tag ? null : tag)}
                    className={cn(
                      "h-7 shrink-0 whitespace-nowrap rounded-full border px-2.5 text-xs transition-colors disabled:pointer-events-none disabled:opacity-40",
                      tagFilter === tag
                        ? "border-primary/40 bg-primary/10 text-primary"
                        : "border-border text-foreground hover:bg-accent",
                    )}
                  >
                    {tag ?? t("common.all")}
                  </button>
                ))}
              </div>
            )}
          </div>
        }
      />

      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-3">
        {filtered.map((flow) => {
          const stepCount = getStepCount(flow);
          const { componentIds, connectionIds } = getFlowParticipants(flow);
          const isSelected = scriptFlowId === flow.id;
          const select = () => openScript(isSelected ? null : flow.id);
          return (
            <div
              key={flow.id}
              data-testid="flow-card"
              onMouseEnter={() => lightParticipants(componentIds, connectionIds)}
              onMouseLeave={unlightParticipants}
              className={cn(
                "group rounded-lg border px-3 py-2.5 transition-colors",
                isSelected ? "border-primary/50 bg-primary/5" : "border-border hover:bg-accent/40",
              )}
            >
              {/* Top-aligned: the mark and the actions belong to the flow's name,
                  and a card whose tags wrap to a second line would otherwise
                  push them into the middle of nothing. */}
              <div className="flex items-start gap-2.5">
                <button
                  type="button"
                  onClick={select}
                  aria-pressed={isSelected}
                  title={isSelected ? t("flows.selectedTitle") : t("flows.selectTitle")}
                  className={cn(
                    "mt-0.5 shrink-0 transition-colors",
                    isSelected ? "text-primary" : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {isSelected ? <CircleDot className="h-4 w-4" /> : <Circle className="h-4 w-4" />}
                </button>
                <button type="button" onClick={select} className="min-w-0 flex-1 text-left">
                  <p className="break-words text-sm font-medium leading-snug text-foreground">
                    {flow.name || t("flowPanel.untitled")}
                  </p>
                  {flow.description && (
                    <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">
                      {flow.description}
                    </p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    {derivedFlowIds.has(flow.id) && (
                      <span
                        data-testid="flow-derived-badge"
                        title={t("diagramKinds.derivedFlowHint")}
                        className="rounded-full bg-primary/10 px-2 py-px text-[11px] text-primary"
                      >
                        {t("diagramKinds.derivedFlow")}
                      </span>
                    )}
                    <span>{t("flowPanel.stepsCount", { count: stepCount })}</span>
                    {componentIds.size > 0 && (
                      <span>{t("flowPanel.participantsCount", { count: componentIds.size })}</span>
                    )}
                    {flow.tags?.slice(0, MAX_CARD_TAGS).map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full bg-secondary px-2 py-px text-[11px] text-secondary-foreground"
                      >
                        {tag}
                      </span>
                    ))}
                    {(flow.tags?.length ?? 0) > MAX_CARD_TAGS && (
                      <span className="text-[11px]">
                        +{(flow.tags?.length ?? 0) - MAX_CARD_TAGS}
                      </span>
                    )}
                  </div>
                </button>
                {/* Quiet until the card is pointed at, focused or selected: six cards of three
                    icons each read as a toolbar, not a list. Touch screens have no hover. */}
                <div
                  data-testid="flow-card-actions"
                  className={cn(
                    "flex shrink-0 items-center gap-0.5 transition-opacity",
                    !isSelected &&
                      "opacity-0 focus-within:opacity-100 group-hover:opacity-100 has-[[data-state=open]]:opacity-100 [@media(hover:none)]:opacity-100",
                  )}
                >
                  <button
                    type="button"
                    disabled={flowOrCompareLocked}
                    onClick={() => handlePlayWithValidation(flow)}
                    className={ROW_ACTION_CLASS + " text-primary hover:text-primary"}
                    title={flowOrCompareLocked ? panelActionsLockedTitle : t("flows.playTitle")}
                  >
                    <Play className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={flowOrCompareLocked}
                    onClick={() => onEditFlow(flow)}
                    className={ROW_ACTION_CLASS}
                    title={flowOrCompareLocked ? panelActionsLockedTitle : t("flows.editTitle")}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        disabled={flowOrCompareLocked}
                        title={
                          flowOrCompareLocked ? panelActionsLockedTitle : t("flows.moreActions")
                        }
                        className={ROW_ACTION_CLASS}
                      >
                        <MoreHorizontal className="h-4 w-4" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-44">
                      <DropdownMenuItem onClick={() => handleDuplicate(flow)}>
                        <Layers className="mr-2 h-3.5 w-3.5" /> {t("flows.duplicateTitle")}
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => handleCopy(flow)}>
                        <Copy className="mr-2 h-3.5 w-3.5" /> {t("flows.copyMermaidTitle")}
                      </DropdownMenuItem>
                      {onRecordGif && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuSub>
                            <DropdownMenuSubTrigger title={t("flows.recordGifHint")}>
                              <Play className="mr-2 h-3.5 w-3.5" /> {t("flows.recordGif")}
                            </DropdownMenuSubTrigger>
                            <DropdownMenuSubContent>
                              {GIF_SPEEDS.map(({ speed, labelKey }) => (
                                <DropdownMenuItem
                                  key={speed}
                                  onClick={() => onRecordGif(flow, speed)}
                                >
                                  {t(labelKey)}
                                </DropdownMenuItem>
                              ))}
                            </DropdownMenuSubContent>
                          </DropdownMenuSub>
                        </>
                      )}
                      {!derivedFlowIds.has(flow.id) && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => removeFlow(flow.id)}
                            className="text-destructive focus:text-destructive"
                          >
                            <Trash2 className="mr-2 h-3.5 w-3.5" /> {t("flows.removeTitle")}
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              </div>
            </div>
          );
        })}

        {filtered.length === 0 && (
          <div className="px-2 py-8 text-center">
            <p className="text-sm text-muted-foreground">
              {tagFilter ? t("flows.emptyTagged") : t("flows.emptyNone")}
            </p>
            {!tagFilter && (
              <p className="mt-1 text-xs text-muted-foreground">{t("flowPanel.emptyHint")}</p>
            )}
          </div>
        )}
      </div>

      {pendingPlay && (
        <BrokenFlowDialog
          flow={pendingPlay.flow}
          brokenSteps={pendingPlay.broken}
          versionInView={versionInView}
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
    </PanelColumn>
  );
};

export default FlowPanel;
