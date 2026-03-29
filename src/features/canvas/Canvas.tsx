import { useState } from "react";
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
import { ConnectedSceneDrawer } from "./toolbar/SceneDrawer";
import ElementPanel from "./panels/ElementPanel/index";
import NodeContextMenu from "./panels/NodeContextMenu";
import { nodeTypes } from "./nodes/node-types";
import QuickInsertPopover from "./toolbar/QuickInsertPopover";
import CanvasSearch from "./toolbar/CanvasSearch";
import { DiagramSidebar } from "./navigation/DiagramSidebar";
import { DiagramCommandPalette } from "./navigation/DiagramCommandPalette";
import { HandleHighlightProvider } from "./contexts/HandleHighlightContext";
import { Eye } from "lucide-react";
import { useCanvasController } from "./hooks/useCanvasController";
import { resolveCanvasSnapshot } from "@/features/diagram";
import { CANVAS_STYLES } from "./constants";
import CustomEdge from "./edges/CustomEdge";
import type { CanvasProps } from "./canvas.types";
import { SaveCustomComponentModal } from "@/features/custom-components/SaveCustomComponentModal";
import { useCustomComponentStore } from "@/features/custom-components";
import { createTemplateDataFromNode } from "@/features/custom-components/utils/customComponentTemplate.utils";
import { CUSTOM_COMPONENT_DRAG_MIME } from "@/features/custom-components/customComponent.constants";
import { useCustomComponentLibrary } from "@/features/custom-components/hooks/useCustomComponentLibrary";

const canvasEdgeTypes = { c4: CustomEdge };

const Canvas = (props: CanvasProps = {}) => {
  const [templateNodeId, setTemplateNodeId] = useState<string | null>(null);
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
    selectedCount,
    showElementPanel,
    onDrillUp,
    isCompareMode,
    allDiagramTags,
  } = useCanvasController(props);

  const templateSourceNode = templateNodeId
    ? nodes.find((node) => node.id === templateNodeId) ?? null
    : null;

  if (!diagram) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        {t("canvas.noDiagramSelected")}
      </div>
    );
  }

  const resolvedSnapshot = resolveCanvasSnapshot(diagram);

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
            selectedCount={selectedCount}
            onClearSelection={visualState.clearCanvasSelection}
            onOpenScenes={() => setShowScenes(true)}
            allTags={allDiagramTags}
            visibleTags={visualState.visibleTags}
            onToggleTag={visualState.toggleTag}
            onShowAllTags={visualState.showAllTags}
            onShowNoTags={visualState.showNoTags}
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
              isOpen={showDiagramSidebar}
              onClose={() => setShowDiagramSidebar(false)}
              currentDiagramId={diagram.id}
              onSelectDiagram={handleSelectDiagram}
            />
          </div>
          <div
              onContextMenu={(e) => e.preventDefault()}
              onDragOver={(event) => {
                if (event.dataTransfer.types.includes(CUSTOM_COMPONENT_DRAG_MIME)) {
                  event.preventDefault();
                  event.dataTransfer.dropEffect = "copy";
                }
              }}
              onDrop={(event) => {
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
              <div className="absolute top-12 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-border bg-card px-4 py-1.5 text-xs text-muted-foreground shadow-sm">
                <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
                {t("canvas.compareViewBanner")}
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
              nodesDraggable={!isRecording && !isCompareMode}
              nodesConnectable={!isRecording && !isCompareMode}
              elementsSelectable={!isRecording && !isCompareMode}
              proOptions={{ hideAttribution: true }}
              className="bg-background"
            >
              <Background variant={BackgroundVariant.Dots} gap={18} size={1.5} />
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
                createdAt: Date.now(),
                updatedAt: Date.now(),
              });
              setTemplateNodeId(null);
            }}
          />
        ) : null}

        {showElementPanel && (
          <div className="absolute inset-y-0 right-0 z-20 flex">
            <ElementPanel
              key={visualState.selectedNodeId ?? visualState.selectedEdgeId ?? "multi"}
              selectedElementId={visualState.selectedNodeId}
              selectedEdgeId={visualState.selectedEdgeId}
              selectedNodeIds={Array.from(visualState.selectedNodeIds)}
              selectedNodes={selectedNodes}
              focusTitleTrigger={focusTitleTrigger}
              onClose={eventHandlers.closePanel}
            />
          </div>
        )}
      </div>
    </HandleHighlightProvider>
  );
};

export default Canvas;
