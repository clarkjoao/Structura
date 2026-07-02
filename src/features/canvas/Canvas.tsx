import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  useReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  PanOnScrollMode,
  SelectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import CanvasToolbar from "./toolbar/CanvasToolbar";
import { JourneysInDiagramPanel } from "./panels/JourneysInDiagramPanel";
import { ConnectedSceneDrawer } from "./toolbar/SceneDrawer";
import ElementPanel from "./panels/ElementPanel/index";
import NodeContextMenu from "./panels/NodeContextMenu";
import { nodeTypes } from "./nodes/node-types";
import QuickInsertPopover from "./toolbar/QuickInsertPopover";
import CanvasSearch from "./toolbar/CanvasSearch";
import { DiagramSidebar } from "./navigation/DiagramSidebar";
import { DiagramCommandPalette } from "./navigation/DiagramCommandPalette";
import { HandleHighlightProvider } from "./contexts/HandleHighlightContext";
import { Eye, Minimize2 } from "lucide-react";
import { useCanvasController } from "./hooks/useCanvasController";
import { hasSavedViewport } from "./hooks/useCanvasEffects";
import { useCanvasInputProfile } from "./hooks/useCanvasInputProfile";
import { useJourneyViewportSync } from "./hooks/useJourneyViewportSync";
import { useServiceFocusFromUrl } from "./hooks/useServiceFocusFromUrl";
import { useElementFocusFromUrl } from "./hooks/useElementFocusFromUrl";
import {
  getCachedCanvasSnapshot,
  isApiGroupComponent,
  isPanelComponent,
  useDiagramStore,
} from "@/features/diagram";
import { useJourneysByDiagramId } from "@/features/journeys";
import { CANVAS_STYLES } from "./constants";
import { getCenterOfNodes, getCopyableIds, getPlatform } from "./hooks/keyboard/helpers";
import CustomEdge from "./edges/CustomEdge";
import type { CanvasProps } from "./canvas.types";
import {
  SaveCustomComponentModal,
  useCustomComponentStore,
  createTemplateDataFromNode,
  CUSTOM_COMPONENT_DRAG_MIME,
  useCustomComponentLibrary,
} from "@/features/custom-components";
import { ChatPanel, FloatingChatButton, PendingNodeToolbar } from "@/components/chat";
import { useLLMChat } from "./chat";
import { getPendingNodeIds, getSuggestionIdForNode, useLLMStore } from "@/features/llm";

const MULTI_SELECTION_KEY_CODES = ["Meta", "Control"];
const PAN_ACTIVATION_KEY = getPlatform() === "mac" ? "Meta" : "Control";
const canvasEdgeTypes = { c4: CustomEdge };

const Canvas = (props: CanvasProps = {}) => {
  const [templateNodeId, setTemplateNodeId] = useState<string | null>(null);
  const [showJourneysPanel, setShowJourneysPanel] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const previousAssistantMessageCountRef = useRef(0);
  const messages = useLLMStore((state) => state.messages);
  const assistantMessageCount = messages.filter(
    (message) => message.role === "assistant",
  ).length;
  const inputProfile = useCanvasInputProfile();
  const reactFlowInstance = useReactFlow();
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
    actions,
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
  } = useCanvasController(props);
  const { pendingPreviews, accept: acceptSuggestion, reject: rejectSuggestion } =
    useLLMChat({
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

  useJourneyViewportSync();
  useServiceFocusFromUrl(visualState);
  useElementFocusFromUrl(visualState);

  const journeysInThisDiagram = useJourneysByDiagramId(diagram?.id ?? "");

  const templateSourceNode = templateNodeId
    ? nodes.find((node) => node.id === templateNodeId) ?? null
    : null;

  useEffect(() => {
    const hasNewAssistantMessage =
      assistantMessageCount > previousAssistantMessageCountRef.current;
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
    if (isFlowActive && showJourneysPanel) {
      setShowJourneysPanel(false);
    }
  }, [isFlowActive, showJourneysPanel]);

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
    setShowJourneysPanel(false);
    setShowScenes(false);
  }, [diagram?.id, setShowScenes]);

  const accept = useCallback(
    (suggestionId: string) => {
      acceptSuggestion(suggestionId);
      setTimeout(() => {
        reactFlowInstance.setNodes((previousNodes) =>
          previousNodes.map((node) => ({ ...node })),
        );
      }, 50);
    },
    [acceptSuggestion, reactFlowInstance],
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
    <HandleHighlightProvider
      value={{
        highlightedConnectionId: visualState.highlightedConnectionId,
        highlightedNodeIds: visualState.highlightedNodeIds,
        setHighlight: visualState.setHighlight,
        clearHighlight: visualState.clearHighlight,
      }}
    >
      <div className="flex-1 flex relative">
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
            journeysInDiagramCount={journeysInThisDiagram.length}
            journeysPanelOpen={showJourneysPanel}
            focusMode={props.focusMode}
            onToggleFocusMode={props.onToggleFocusMode}
            onToggleJourneysPanel={() => {
              if (isFlowActive) return;
              setShowJourneysPanel((previous) => !previous);
            }}
          />
          {showJourneysPanel ? (
            <JourneysInDiagramPanel
              diagramId={diagram.id}
              onClose={() => setShowJourneysPanel(false)}
            />
          ) : null}
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
              onNodeClick={eventHandlers.onNodeClick}
              onEdgeClick={eventHandlers.onEdgeClick}
              onNodeDoubleClick={eventHandlers.onNodeDoubleClick}
              onEdgeDoubleClick={eventHandlers.onEdgeDoubleClick}
              onPaneClick={eventHandlers.onPaneClick}
              onPaneContextMenu={eventHandlers.onPaneContextMenu}
              onNodeContextMenu={eventHandlers.onNodeContextMenu}
              onNodeDragStop={onNodeDragStop}
              onSelectionChange={eventHandlers.onSelectionChange}
              panOnDrag={inputProfile.prefersTouchCanvasUi ? true : [2]}
              panOnScroll
              panOnScrollMode={PanOnScrollMode.Free}
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
              snapToGrid
              snapGrid={[15, 15]}
              defaultViewport={initialViewport}
              fitView={!hasSavedViewport(initialViewport)}
              fitViewOptions={{ padding: 0.3 }}
              onMoveEnd={eventHandlers.onMoveEnd}
              nodesDraggable={interactionMode.canEditCanvas}
              nodesConnectable={interactionMode.canEditCanvas}
              elementsSelectable={interactionMode.canEditCanvas}
              proOptions={{ hideAttribution: true }}
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
              <Controls className="!bg-card !border-border !rounded-lg !shadow-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-muted-foreground [&>button:hover]:!bg-surface-hover [&>button]:!rounded-md [&>button]:!w-8 [&>button]:!h-8" />
            </ReactFlow>
          </div>
        </div>

        {visualState.contextMenu &&
          (() => {
            const contextMenuId = visualState.contextMenu.elementId;
            const contextMenuComponent = resolvedSnapshot?.components[contextMenuId];
            const isContextMenuIdSelected = visualState.selectedNodeIds.has(contextMenuId);
            const effectiveIds =
              isContextMenuIdSelected && visualState.selectedNodeIds.size > 1
                ? [...visualState.selectedNodeIds]
                : [contextMenuId];
            const selectionCount = effectiveIds.length;
            const effectiveNodes = reactFlowInstance
              .getNodes()
              .filter((node) => effectiveIds.includes(node.id));
            const canEditContextActions = interactionMode.canEditCanvas;

            const handleCopy =
              canEditContextActions && diagram
                ? () => {
                    const copyableIds = getCopyableIds(diagram, effectiveNodes);
                    if (copyableIds.length > 0) {
                      actions.copyToClipboard(copyableIds);
                    }
                  }
                : undefined;

            const selectPastedNodes = (newIds: string[]) => {
              if (newIds.length === 0) return;
              reactFlowInstance.setNodes((previousNodes) =>
                previousNodes.map((node) => ({ ...node, selected: newIds.includes(node.id) })),
              );
            };

            const handlePaste =
              canEditContextActions && diagram
                ? () => {
                    const pasteCenter = getCenterOfNodes(diagram, effectiveIds);
                    const newIds = actions.pasteFromClipboard(pasteCenter);
                    selectPastedNodes(newIds);
                  }
                : undefined;

            const handleDuplicate =
              canEditContextActions && diagram
                ? () => {
                    const copyableIds = getCopyableIds(diagram, effectiveNodes);
                    if (copyableIds.length === 0) return;
                    actions.copyToClipboard(copyableIds);
                    const pasteCenter = getCenterOfNodes(diagram, copyableIds);
                    const newIds = actions.pasteFromClipboard(pasteCenter);
                    selectPastedNodes(newIds);
                  }
                : undefined;

            const handleDelete = canEditContextActions
              ? () => {
                  for (const selectedId of effectiveIds) {
                    actions.removeComponent(selectedId);
                  }
                }
              : undefined;

            const canGroup =
              canEditContextActions &&
              effectiveIds.length >= 2 &&
              effectiveIds.every((selectedId) => {
                const selectedComponent = resolvedSnapshot?.components[selectedId];
                return !!selectedComponent && !isApiGroupComponent(selectedComponent);
              });
            const handleGroup = canGroup ? () => actions.groupNodes(effectiveIds) : undefined;

            const canUngroup =
              canEditContextActions &&
              effectiveIds.length === 1 &&
              !!contextMenuComponent &&
              (isPanelComponent(contextMenuComponent) || !!contextMenuComponent.parentId);
            const handleUngroup = canUngroup
              ? () => {
                  if (contextMenuComponent && isPanelComponent(contextMenuComponent)) {
                    actions.ungroupNodes(contextMenuId);
                    return;
                  }

                  if (contextMenuComponent?.parentId) {
                    const parentLayout = resolvedSnapshot?.nodeLayouts[contextMenuComponent.parentId];
                    const childLayout = resolvedSnapshot?.nodeLayouts[contextMenuId];
                    if (!parentLayout || !childLayout) return;

                    actions.setParent(contextMenuId, null);
                    actions.updateNodeLayout(contextMenuId, {
                      x: childLayout.x + parentLayout.x,
                      y: childLayout.y + parentLayout.y,
                    });
                  }
                }
              : undefined;

            return (
              <NodeContextMenu
                x={visualState.contextMenu.x}
                y={visualState.contextMenu.y}
                elementId={contextMenuId}
                onBringToFront={actions.bringToFront}
                onSendToBack={actions.sendToBack}
                onSaveAsTemplate={setTemplateNodeId}
                onFitToChildren={
                  contextMenuComponent && isPanelComponent(contextMenuComponent)
                    ? actions.fitGroupToChildren
                    : undefined
                }
                onClose={() => visualState.setContextMenu(null)}
                onCopy={handleCopy}
                onPaste={handlePaste}
                onDuplicate={handleDuplicate}
                onDelete={handleDelete}
                onGroup={handleGroup}
                onUngroup={handleUngroup}
                onAutoLayout={interactionMode.canEditCanvas ? handleAutoLayout : undefined}
                isAutoLayoutRunning={isAutoLayoutRunning}
                selectionCount={selectionCount}
                platform={getPlatform()}
              />
            );
          })()}

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
                registryServiceId: templateData.registryServiceId,
                templateVersion: 1,
                category: "general",
                createdAt: Date.now(),
                updatedAt: Date.now(),
              });
              setTemplateNodeId(null);
            }}
          />
        ) : null}

        <div className="absolute inset-y-0 right-0 z-20 flex items-stretch">
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
            <ChatPanel
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
