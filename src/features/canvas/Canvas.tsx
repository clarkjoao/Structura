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
import ElementPanel, { type FocusCanvasElementTarget } from "./panels/ElementPanel/index";
import NodeContextMenu from "./panels/NodeContextMenu";
import { nodeTypes } from "./nodes/node-types";
import QuickInsertPopover from "./toolbar/QuickInsertPopover";
import CanvasSearch from "./toolbar/CanvasSearch";
import { DiagramSidebar } from "./navigation/DiagramSidebar";
import { DiagramCommandPalette } from "./navigation/DiagramCommandPalette";
import { HandleHighlightProvider } from "./contexts/HandleHighlightContext";
import { Eye } from "lucide-react";
import { useCanvasController } from "./hooks/useCanvasController";
import { useJourneyViewportSync } from "./hooks/useJourneyViewportSync";
import { getCachedCanvasSnapshot, isPanelComponent } from "@/features/diagram";
import { useJourneysByDiagramId } from "@/features/journeys";
import { CANVAS_STYLES } from "./constants";
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
import { getPendingNodeIds, getSuggestionIdForNode } from "@/features/llm";
import { useLLMStore } from "@/features/llm/store";

const canvasEdgeTypes = { c4: CustomEdge };

const Canvas = (props: CanvasProps = {}) => {
  const [templateNodeId, setTemplateNodeId] = useState<string | null>(null);
  const [showJourneysPanel, setShowJourneysPanel] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [hasUnread, setHasUnread] = useState(false);
  const previousAssistantMessageCountRef = useRef(0);
  const messages = useLLMStore((state) => state.messages);
  const { pendingPreviews, accept: acceptSuggestion, reject: rejectSuggestion } = useLLMChat();
  const pendingNodeIds = useMemo(
    () => Array.from(getPendingNodeIds(pendingPreviews)),
    [pendingPreviews],
  );
  const assistantMessageCount = messages.filter(
    (message) => message.role === "assistant",
  ).length;
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
    isRecording,
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
  } = useCanvasController(props);

  useJourneyViewportSync();

  const journeysInThisDiagram = useJourneysByDiagramId(diagram?.id ?? "");

  const {
    setSelectedNodeId: focusSetSelectedNodeId,
    setSelectedNodeIds: focusSetSelectedNodeIds,
    setSelectedEdgeId: focusSetSelectedEdgeId,
  } = visualState;

  const handleFocusCanvasElement = useCallback(
    (target: FocusCanvasElementTarget) => {
      if (target.kind === "node") {
        focusSetSelectedNodeId(target.id);
        focusSetSelectedNodeIds(new Set([target.id]));
        focusSetSelectedEdgeId(null);
      } else {
        focusSetSelectedEdgeId(target.id);
        focusSetSelectedNodeId(null);
        focusSetSelectedNodeIds(new Set());
      }
    },
    [focusSetSelectedNodeId, focusSetSelectedNodeIds, focusSetSelectedEdgeId],
  );

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
            onOpenScenes={() => setShowScenes(true)}
            allTags={allDiagramTags}
            visibleTags={visualState.visibleTags}
            onToggleTag={visualState.toggleTag}
            onShowAllTags={visualState.showAllTags}
            onShowNoTags={visualState.showNoTags}
            journeysInDiagramCount={journeysInThisDiagram.length}
            journeysPanelOpen={showJourneysPanel}
            onToggleJourneysPanel={() =>
              setShowJourneysPanel((previous) => !previous)
            }
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
              isOpen={showDiagramSidebar}
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
              panOnDrag={[2]}
              panOnScroll
              panOnScrollMode={PanOnScrollMode.Free}
              selectionOnDrag
              selectionMode={SelectionMode.Partial}
              zoomOnScroll={false}
              zoomOnPinch
              deleteKeyCode={null}
              zoomOnDoubleClick={false}
              minZoom={0.3}
              maxZoom={1.5}
              multiSelectionKeyCode="Meta"
              defaultViewport={diagram.viewport}
              fitView
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

        {visualState.contextMenu && (
          <NodeContextMenu
            x={visualState.contextMenu.x}
            y={visualState.contextMenu.y}
            elementId={visualState.contextMenu.elementId}
            onBringToFront={actions.bringToFront}
            onSendToBack={actions.sendToBack}
            onSaveAsTemplate={setTemplateNodeId}
            onFitToChildren={
              isPanelComponent(resolvedSnapshot?.components[visualState.contextMenu.elementId])
                ? actions.fitGroupToChildren
                : undefined
            }
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
          <div className="flex items-end pb-5 pr-4 pointer-events-none">
            <div className="pointer-events-auto">
              <FloatingChatButton
                isOpen={isChatOpen}
                hasUnread={hasUnread}
                onClick={() => {
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
          {showElementPanel && (
            <ElementPanel
              key={visualState.selectedNodeId ?? visualState.selectedEdgeId ?? "multi"}
              selectedElementId={visualState.selectedNodeId}
              selectedEdgeId={visualState.selectedEdgeId}
              selectedNodeIds={Array.from(visualState.selectedNodeIds)}
              selectedNodes={selectedNodes}
              focusTitleTrigger={focusTitleTrigger}
              onClose={eventHandlers.closePanel}
              onFocusCanvasElement={handleFocusCanvasElement}
            />
          )}
          {isChatOpen ? (
            <ChatPanel onClose={() => setIsChatOpen(false)} />
          ) : null}
        </div>
      </div>
    </HandleHighlightProvider>
  );
};

export default Canvas;
