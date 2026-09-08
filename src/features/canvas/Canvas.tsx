import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  useReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  MiniMap,
  Panel,
  SelectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import CanvasToolbar from "./toolbar/CanvasToolbar";
import { ConnectedSceneDrawer } from "./toolbar/SceneDrawer";
import ElementPanel from "./panels/ElementPanel/index";
import { CanvasContextMenu } from "./panels/CanvasContextMenu";
import { useNodeTypes } from "./nodes/node-types";
import QuickInsertPopover from "./toolbar/QuickInsertPopover";
import CanvasSearch from "./toolbar/CanvasSearch";
import { CanvasViewOptions } from "./toolbar/components/CanvasViewOptions";
import { NothingInViewCard } from "./components/NothingInViewCard";
import { makeMiniMapNodeColor } from "./components/miniMapNodeColor";
import { useViewportOccupancy } from "./hooks/useViewportOccupancy";
import { useCanvasPreferencesStore } from "./preferences";
import { DiagramSidebar } from "./navigation/DiagramSidebar";
import { DiagramCommandPalette } from "./navigation/DiagramCommandPalette";
import { HandleHighlightProvider } from "./contexts/HandleHighlightContext";
import { NodeQuickActionsBar } from "./selection-actions/NodeQuickActionsBar";
import { Eye, Minimize2 } from "lucide-react";
import { useCanvasController } from "./hooks/useCanvasController";
import { hasSavedViewport } from "./hooks/useCanvasEffects";
import { useCanvasInputProfile } from "./hooks/useCanvasInputProfile";
import { useFlowSewNotices } from "./flow/useFlowSewNotices";
import { useServiceFocusFromUrl } from "./hooks/useServiceFocusFromUrl";
import { useElementFocusFromUrl } from "./hooks/useElementFocusFromUrl";
import { getCachedCanvasSnapshot, useDiagramStore } from "@/features/diagram";
import { CANVAS_STYLES, GRID_SIZE, isSnapToGridDisabledForE2E } from "./canvas.constants";
import { DRAG_THRESHOLD_PX } from "./selection/dragThreshold";
import EditableEdge from "./edges/EditableEdge";
import { useEdgeReconnect } from "./edges/interaction/useEdgeReconnect";
import type { CanvasProps } from "./canvas.types";
import {
  SaveCustomComponentModal,
  useCustomComponentStore,
  createTemplateDataFromNode,
  CUSTOM_COMPONENT_DRAG_MIME,
  useCustomComponentLibrary,
} from "@/features/custom-components";
import {
  AssistantUIChatPanel,
  FloatingChatButton,
  PendingNodeToolbar,
} from "@/features/llm/components";
import { useLLMChat } from "./chat";
import { getPendingNodeIds, getSuggestionIdForNode, useLLMStore } from "@/features/llm";
import { usePanelChildLayout } from "./hooks/usePanelChildLayout";
import { useResolvedComponents } from "@/features/diagram";
import { isPanelComponent, isApiGroupComponent } from "@/features/diagram";

/**
 * Phase 4 — selection epic.
 *
 * Selection modifiers (any of these toggle/add to multi-selection):
 *   Meta (macOS Cmd) / Control (Win/Linux Ctrl) / Shift.
 *
 * Pan modifier: holding Space + drag pans. Middle-button and right-button
 * drags also pan; the right-button path is gated by the pointer funnel —
 * short press opens the context menu, long press pans.
 *
 * Decision #8: **a right-drag pans from anywhere on the canvas**, nodes and
 * panels included. An earlier revision of this docblock declared the opposite
 * ("right-button pan is a pane gesture") and eight `it.skip`s in
 * `cypress/e2e/right-button-context-menu.cy.ts` kept that gap named; the
 * product owner revoked the rule, the tests are live, and they are the
 * acceptance criterion.
 *
 * Two mechanisms deliver it, and which one runs is decided once, at
 * pointerdown, so they can never both move the viewport for one gesture:
 *
 *   - press outside `.nopan`  →  d3-zoom pans, via `panOnDrag=[1, 2]`;
 *   - press inside `.nopan`   →  the pointer funnel pans, translating the
 *     viewport by the pointer delta through `setViewport`.
 *
 * `.react-flow__node` carries `nopan`, which is why the second branch exists.
 * The branch is owned here rather than removed at the source because
 * `noPanClassName` — the only prop that reaches React Flow's filter — is
 * global: renaming the class re-enables pan over every text field, slider and
 * quick-action bar inside a node too. React Flow itself takes the same shape,
 * hardcoding one early return for the MIDDLE button over nodes and edges in
 * `createFilter`; it just has no equivalent for the right button. See the
 * precedence docblock in `selection/pointerFunnel.ts`.
 *
 * `selectionKeyCode` is neutralised (set to `null`) so React Flow's default
 * "Shift = selection mode" does not fight our Shift-as-multi-selection
 * modifier. With the default, holding Shift would flip `selectionKeyPressed`
 * which forces `panOnDrag=false` and disables `selectionOnDrag`, breaking
 * Shift+drag-marquee.
 */
const MULTI_SELECTION_KEY_CODES = ["Meta", "Control", "Shift"];
const PAN_ACTIVATION_KEY = "Space";
const SELECTION_KEY_CODE: string | null = null;
const canvasEdgeTypes = { editable: EditableEdge };

/**
 * Every prop React Flow tracks in `reactFlowFieldsToTrack` is written into its
 * zustand store whenever its *identity* changes, and each write runs the
 * selector of every subscriber — one per node on screen. An inline `[15, 15]`
 * or `{ padding: 0.3 }` is therefore a full store notification per Canvas
 * render: measured at 226 apiece over a single 6 s drag of 150 nodes.
 */
const SNAP_GRID: [number, number] = [GRID_SIZE, GRID_SIZE];
const FIT_VIEW_OPTIONS = { padding: 0.3 };
const PRO_OPTIONS = { hideAttribution: true };
const PAN_ON_DRAG_MOUSE: [number, number] = [1, 2];

const Canvas = (props: CanvasProps = {}) => {
  useFlowSewNotices();
  const nodeTypes = useNodeTypes();
  const [templateNodeId, setTemplateNodeId] = useState<string | null>(null);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const previousAssistantMessageCountRef = useRef(0);
  const messages = useLLMStore((state) => state.messages);
  const assistantMessageCount = messages.filter((message) => message.role === "assistant").length;
  const inputProfile = useCanvasInputProfile();
  const reactFlowInstance = useReactFlow();
  const edgeReconnect = useEdgeReconnect();
  const addTemplate = useCustomComponentStore((state) => state.addTemplate);
  const { instantiateTemplate } = useCustomComponentLibrary();
  const {
    t,
    diagram,
    reactFlowWrapperRef,
    visualState,
    nodes,
    edges,
    onNodesChange,
    onNodeDragStop,
    eventHandlers,
    interactionMode,
    showSearch,
    setShowSearch,
    showDiagramSidebar,
    setShowDiagramSidebar,
    showCommandPalette,
    setShowCommandPalette,
    showScenes,
    setShowScenes,
    handleSelectDiagram,
    handleSearchSelect,
    focusTitleTrigger,
    isPanelOpen,
    selectedNodes,
    showElementPanel,
    onDrillUp,
    isCompareMode,
    allDiagramTags,
    handleAutoLayout,
    isAutoLayoutRunning,
    actions,
  } = useCanvasController(props);
  const {
    pendingPreviews,
    accept: acceptSuggestion,
    reject: rejectSuggestion,
  } = useLLMChat({
    selectedNodeIds: visualState.selectedNodeIds,
    selectedNodeId: visualState.selectedNodeId,
  });
  const pendingNodeIds = useMemo(
    () => Array.from(getPendingNodeIds(pendingPreviews)),
    [pendingPreviews],
  );
  const { isFlowActive } = interactionMode;
  const initialViewport = useDiagramStore(
    useCallback((state) => {
      const activeDiagramId = state.activeDiagramId;
      return activeDiagramId ? state.diagrams[activeDiagramId]?.viewport : undefined;
    }, []),
  );

  useServiceFocusFromUrl(visualState);
  useElementFocusFromUrl(visualState);

  const showMiniMap = useCanvasPreferencesStore((state) => state.showMiniMap);
  const occupancy = useViewportOccupancy();

  const templateSourceNode = templateNodeId
    ? (nodes.find((node) => node.id === templateNodeId) ?? null)
    : null;

  useEffect(() => {
    const hasNewAssistantMessage = assistantMessageCount > previousAssistantMessageCountRef.current;
    if (hasNewAssistantMessage && !isChatOpen) {
      setHasUnread(true);
    }
    previousAssistantMessageCountRef.current = assistantMessageCount;
  }, [assistantMessageCount, isChatOpen]);

  useEffect(() => {
    if (isFlowActive && isChatOpen) {
      setIsChatOpen(false);
    }
  }, [isFlowActive, isChatOpen]);

  useEffect(() => {
    if (isFlowActive && showScenes) {
      setShowScenes(false);
    }
  }, [isFlowActive, showScenes, setShowScenes]);

  useEffect(() => {
    if (isFlowActive && showDiagramSidebar) {
      setShowDiagramSidebar(false);
    }
  }, [isFlowActive, showDiagramSidebar, setShowDiagramSidebar]);

  useEffect(() => {
    setShowScenes(false);
  }, [diagram?.id, setShowScenes]);

  const accept = useCallback(
    (suggestionId: string) => {
      acceptSuggestion(suggestionId);
      setTimeout(() => {
        reactFlowInstance.setNodes((previousNodes) => previousNodes.map((node) => ({ ...node })));
      }, 50);
    },
    [acceptSuggestion, reactFlowInstance],
  );

  // QuickActionsBar context: detect panel-with-children vs child-of-panel
  const resolvedComponents = useResolvedComponents();
  const selectedSingleId = visualState.selectedNodeId;
  const selectedComponent =
    selectedSingleId && selectedNodes.length === 1 ? resolvedComponents[selectedSingleId] : null;
  const isSelectedPanel = !!selectedComponent && isPanelComponent(selectedComponent);
  const isSelectedApiGroup = !!selectedComponent && isApiGroupComponent(selectedComponent);
  const parentComp = selectedComponent?.parentId
    ? resolvedComponents[selectedComponent.parentId]
    : undefined;
  const isSelectedChildOfGroup =
    !!selectedComponent?.parentId &&
    !!parentComp &&
    (isPanelComponent(parentComp) || isApiGroupComponent(parentComp));
  const hasPanelChildren =
    (isSelectedPanel || isSelectedApiGroup) &&
    Object.values(resolvedComponents).some((c) => c.parentId === selectedSingleId);

  const { runPanelChildLayout, isRunning: isPanelLayoutRunning } = usePanelChildLayout();
  const handleUngroup = useCallback(() => {
    if (!selectedSingleId) return;
    actions.ungroupNodes(selectedSingleId);
  }, [actions, selectedSingleId]);
  const handleFitToChildren = useCallback(() => {
    if (!selectedSingleId) return;
    actions.fitGroupToChildren(selectedSingleId);
  }, [actions, selectedSingleId]);
  const handleOrganizeChildren = useCallback(() => {
    if (!selectedSingleId) return;
    runPanelChildLayout(selectedSingleId);
  }, [runPanelChildLayout, selectedSingleId]);
  const handleRemoveFromGroup = useCallback(() => {
    if (!selectedComponent?.parentId) return;
    actions.setParent(selectedSingleId!, null);
  }, [actions, selectedComponent?.parentId, selectedSingleId]);

  /**
   * Every node type reads this context. An object literal here changes identity
   * on each Canvas render — and `useLocalNodes` ticks one per drag frame — so
   * all of them re-rendered every frame, `memo` or not. Keyed on the four
   * values it carries, the identity now only moves when a highlight does.
   */
  const handleHighlightValue = useMemo(
    () => ({
      highlightedConnectionId: visualState.highlightedConnectionId,
      highlightedNodeIds: visualState.highlightedNodeIds,
      setHighlight: visualState.setHighlight,
      clearHighlight: visualState.clearHighlight,
    }),
    [
      visualState.highlightedConnectionId,
      visualState.highlightedNodeIds,
      visualState.setHighlight,
      visualState.clearHighlight,
    ],
  );

  if (!diagram) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        {t("canvas.noDiagramSelected")}
      </div>
    );
  }

  const resolvedSnapshot = getCachedCanvasSnapshot(diagram);

  return (
    <HandleHighlightProvider value={handleHighlightValue}>
      <div className="flex-1 flex relative h-full min-h-0">
        <style>{CANVAS_STYLES}</style>
        <div ref={reactFlowWrapperRef} className="flex-1 relative">
          {showScenes && <ConnectedSceneDrawer onClose={() => setShowScenes(false)} />}
          <CanvasToolbar
            onDrillUp={onDrillUp}
            isPanelOpen={isPanelOpen}
            onClearSelection={visualState.clearCanvasSelection}
            setSelectedNodeId={visualState.setSelectedNodeId}
            setSelectedNodeIds={visualState.setSelectedNodeIds}
            setSelectedEdgeId={visualState.setSelectedEdgeId}
            onOpenScenes={() => setShowScenes(true)}
            isFlowActive={isFlowActive}
            allTags={allDiagramTags}
            visibleTags={visualState.visibleTags}
            onToggleTag={visualState.toggleTag}
            onShowAllTags={visualState.showAllTags}
            onShowNoTags={visualState.showNoTags}
            focusMode={props.focusMode}
            onToggleFocusMode={props.onToggleFocusMode}
          />
          {showSearch && diagram && (
            <CanvasSearch
              onClose={() => setShowSearch(false)}
              onSelectResult={handleSearchSelect}
              components={resolvedSnapshot.components}
            />
          )}
          <div className="absolute inset-y-0 left-0 z-30 flex">
            <DiagramSidebar
              isOpen={showDiagramSidebar && !isFlowActive}
              onClose={() => setShowDiagramSidebar(false)}
              currentDiagramId={diagram.id}
              onSelectDiagram={handleSelectDiagram}
            />
          </div>
          <div
            onContextMenu={(e) => e.preventDefault()}
            onDragOver={(event) => {
              if (!interactionMode.canEditCanvas) return;
              if (event.dataTransfer.types.includes(CUSTOM_COMPONENT_DRAG_MIME)) {
                event.preventDefault();
                event.dataTransfer.dropEffect = "copy";
              }
            }}
            onDrop={(event) => {
              if (!interactionMode.canEditCanvas) return;
              const templateId = event.dataTransfer.getData(CUSTOM_COMPONENT_DRAG_MIME);
              if (!templateId) return;
              event.preventDefault();
              const position = reactFlowInstance.screenToFlowPosition({
                x: event.clientX,
                y: event.clientY,
              });
              instantiateTemplate({ templateId, position });
            }}
            className="w-full h-full"
          >
            {isCompareMode && (
              <div className="absolute top-12 left-1/2 z-20 flex max-w-[min(100vw-2rem,42rem)] -translate-x-1/2 flex-col items-center gap-2 rounded-xl border border-border bg-card px-4 py-2 text-xs text-muted-foreground shadow-sm sm:flex-row sm:flex-wrap sm:justify-center">
                <div className="flex items-center gap-2">
                  <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{t("canvas.compareViewBanner")}</span>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-3 text-[11px]">
                  <span className="flex items-center gap-1">
                    <span className="h-3 w-3 shrink-0 rounded-full bg-green-500" aria-hidden />
                    {t("compareMode.added")}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-3 w-3 shrink-0 rounded-full bg-red-500" aria-hidden />
                    {t("compareMode.removed")}
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="h-3 w-3 shrink-0 rounded-full bg-amber-500" aria-hidden />
                    {t("compareMode.modified")}
                  </span>
                </div>
              </div>
            )}
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={canvasEdgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={eventHandlers.onEdgesChange}
              onConnect={eventHandlers.onConnect}
              onConnectEnd={eventHandlers.onConnectEnd}
              onReconnect={edgeReconnect.onReconnect}
              onReconnectStart={edgeReconnect.onReconnectStart}
              onReconnectEnd={edgeReconnect.onReconnectEnd}
              onNodeClick={eventHandlers.onNodeClick}
              onEdgeClick={eventHandlers.onEdgeClick}
              onNodeDoubleClick={eventHandlers.onNodeDoubleClick}
              onEdgeDoubleClick={eventHandlers.onEdgeDoubleClick}
              onPaneClick={eventHandlers.onPaneClick}
              onPaneContextMenu={eventHandlers.onPaneContextMenu}
              onNodeContextMenu={eventHandlers.onNodeContextMenu}
              onNodeDragStop={onNodeDragStop}
              onSelectionChange={eventHandlers.onSelectionChange}
              panOnDrag={inputProfile.prefersTouchCanvasUi ? true : PAN_ON_DRAG_MOUSE}
              panOnScroll={false}
              selectionOnDrag={!inputProfile.prefersTouchCanvasUi}
              panActivationKeyCode={inputProfile.prefersTouchCanvasUi ? null : PAN_ACTIVATION_KEY}
              selectionMode={SelectionMode.Partial}
              zoomOnScroll={false}
              zoomOnPinch
              deleteKeyCode={null}
              zoomOnDoubleClick={false}
              minZoom={0.3}
              maxZoom={1.5}
              multiSelectionKeyCode={MULTI_SELECTION_KEY_CODES}
              selectionKeyCode={SELECTION_KEY_CODE}
              nodeDragThreshold={DRAG_THRESHOLD_PX}
              snapToGrid={!isSnapToGridDisabledForE2E()}
              snapGrid={SNAP_GRID}
              defaultViewport={initialViewport}
              fitView={!hasSavedViewport(initialViewport)}
              fitViewOptions={FIT_VIEW_OPTIONS}
              onMoveEnd={eventHandlers.onMoveEnd}
              nodesDraggable={interactionMode.canEditCanvas}
              nodesConnectable={interactionMode.canEditCanvas}
              elementsSelectable={interactionMode.canEditCanvas}
              proOptions={PRO_OPTIONS}
              className="bg-background"
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1.5} />
              {pendingNodeIds.map((nodeId) => {
                const suggestionId = getSuggestionIdForNode(pendingPreviews, nodeId);
                if (!suggestionId) {
                  return null;
                }
                return (
                  <PendingNodeToolbar
                    key={nodeId}
                    nodeId={nodeId}
                    suggestionId={suggestionId}
                    onKeep={accept}
                    onDiscard={rejectSuggestion}
                  />
                );
              })}
              {/* QuickActions toolbar for single node selection */}
              {visualState.selectedNodeId && selectedNodes.length === 1 && (
                <NodeQuickActionsBar
                  nodeId={visualState.selectedNodeId}
                  diagramId={diagram?.id ?? ""}
                  updateComponent={actions.updateComponent}
                  onUngroup={
                    (isSelectedPanel || isSelectedApiGroup) && hasPanelChildren
                      ? handleUngroup
                      : undefined
                  }
                  onFitToChildren={
                    (isSelectedPanel || isSelectedApiGroup) &&
                    hasPanelChildren &&
                    !(selectedComponent as { collapsed?: boolean })?.collapsed
                      ? handleFitToChildren
                      : undefined
                  }
                  onOrganizeChildren={
                    (isSelectedPanel || isSelectedApiGroup) &&
                    hasPanelChildren &&
                    !(selectedComponent as { collapsed?: boolean })?.collapsed &&
                    !isPanelLayoutRunning
                      ? handleOrganizeChildren
                      : undefined
                  }
                  onRemoveFromGroup={isSelectedChildOfGroup ? handleRemoveFromGroup : undefined}
                />
              )}
              <Controls className="!bg-card !border-border !rounded-lg !shadow-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-muted-foreground [&>button:hover]:!bg-surface-hover [&>button]:!rounded-md [&>button]:!w-8 [&>button]:!h-8" />
              <Panel position="bottom-left" className="!mb-4 !ml-[3.25rem]">
                <CanvasViewOptions />
              </Panel>
              {showMiniMap && (
                <MiniMap
                  pannable
                  zoomable
                  position="bottom-right"
                  nodeColor={makeMiniMapNodeColor(resolvedSnapshot.components)}
                  /* Offset above the floating chat button, which also sits bottom-right. */
                  className="!mb-20 !mr-4 !bg-card !border !border-border !rounded-lg !shadow-lg"
                  maskColor="hsl(var(--muted) / 0.6)"
                />
              )}
              {occupancy.hasNodes && !occupancy.anyNodeVisible && (
                <NothingInViewCard elementCount={occupancy.nodeCount} />
              )}
            </ReactFlow>
          </div>
        </div>

        {visualState.contextMenu && (
          <CanvasContextMenu
            contextMenu={visualState.contextMenu}
            diagram={diagram}
            resolvedSnapshot={resolvedSnapshot}
            selectedNodeIds={visualState.selectedNodeIds}
            canEditCanvas={interactionMode.canEditCanvas}
            onSaveAsTemplate={setTemplateNodeId}
            onAutoLayout={handleAutoLayout}
            isAutoLayoutRunning={isAutoLayoutRunning}
            onClose={() => visualState.setContextMenu(null)}
          />
        )}

        {visualState.quickInsert && (
          <QuickInsertPopover
            screenPos={visualState.quickInsert.screenPos}
            flowPos={visualState.quickInsert.flowPos}
            sourceNodeId={visualState.quickInsert.sourceNodeId}
            onInsert={eventHandlers.handleQuickInsert}
            onClose={() => visualState.setQuickInsert(null)}
          />
        )}

        {showCommandPalette && (
          <DiagramCommandPalette
            onClose={() => setShowCommandPalette(false)}
            onSelectDiagram={handleSelectDiagram}
          />
        )}

        {templateSourceNode ? (
          <SaveCustomComponentModal
            defaultName={String(
              resolvedSnapshot.components[templateSourceNode.id]?.name ??
                templateSourceNode.data?.name ??
                "",
            )}
            defaultDescription={
              resolvedSnapshot.components[templateSourceNode.id]?.description ??
              (typeof templateSourceNode.data?.description === "string"
                ? templateSourceNode.data.description
                : undefined)
            }
            onClose={() => setTemplateNodeId(null)}
            onSave={(name, description) => {
              const domainComponent = resolvedSnapshot.components[templateSourceNode.id];
              const templateData = createTemplateDataFromNode(templateSourceNode, domainComponent);
              addTemplate({
                id: crypto.randomUUID(),
                name,
                description,
                baseType: templateData.baseType,
                data: templateData.data,
                serviceId: templateData.serviceId,
                templateVersion: 1,
                category: "general",
                createdAt: Date.now(),
                updatedAt: Date.now(),
              });
              setTemplateNodeId(null);
            }}
          />
        ) : null}

        <div className="absolute inset-y-0 right-0 z-20 flex items-stretch h-full">
          <div className="pointer-events-none flex h-full min-h-0 flex-col items-end">
            {props.focusMode && props.onToggleFocusMode ? (
              <div className="shrink-0 pt-4 pr-4">
                <button
                  type="button"
                  onClick={props.onToggleFocusMode}
                  className="pointer-events-auto inline-flex items-center gap-1.5 rounded-lg border border-border bg-card/90 px-3 py-2 text-xs font-medium text-muted-foreground backdrop-blur-sm transition-colors hover:bg-surface-hover hover:text-foreground"
                  title={t("canvasToolbar.exitFocusMode")}
                >
                  <Minimize2 className="h-3.5 w-3.5" aria-hidden />
                  {t("canvasToolbar.exitFocusMode")}
                </button>
              </div>
            ) : null}
            <div className="mt-auto flex pb-5 pr-4">
              <div className="pointer-events-auto">
                <FloatingChatButton
                  isOpen={isChatOpen}
                  hasUnread={hasUnread}
                  onClick={() => {
                    if (isFlowActive) return;
                    setIsChatOpen((previous) => {
                      const next = !previous;
                      if (next) {
                        setHasUnread(false);
                      }
                      return next;
                    });
                  }}
                />
              </div>
            </div>
          </div>
          {showElementPanel && (
            <ElementPanel
              key={visualState.selectedNodeId ?? visualState.selectedEdgeId ?? "multi"}
              selectedElementId={visualState.selectedNodeId}
              selectedEdgeId={visualState.selectedEdgeId}
              selectedNodeIds={Array.from(visualState.selectedNodeIds)}
              selectedNodes={selectedNodes}
              focusTitleTrigger={focusTitleTrigger}
              onClose={eventHandlers.closePanel}
            />
          )}
          {isChatOpen ? (
            <AssistantUIChatPanel
              onClose={() => setIsChatOpen(false)}
              selectedNodeIds={visualState.selectedNodeIds}
              selectedNodeId={visualState.selectedNodeId}
            />
          ) : null}
        </div>
      </div>
    </HandleHighlightProvider>
  );
};

export default Canvas;
