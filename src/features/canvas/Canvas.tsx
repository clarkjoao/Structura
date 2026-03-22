import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  PanOnScrollMode,
  SelectionMode,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import CanvasToolbar from "./toolbar/CanvasToolbar";
import { SceneToolbarStrip } from "./toolbar/SceneToolbarStrip";
import ElementPanel from "./panels/ElementPanel/index";
import NodeContextMenu from "./panels/NodeContextMenu";
import { nodeTypes } from "./nodes/node-types";
import QuickInsertPopover from "./toolbar/QuickInsertPopover";
import CanvasSearch from "./toolbar/CanvasSearch";
import { DiagramSidebar } from "./navigation/DiagramSidebar";
import { DiagramCommandPalette } from "./navigation/DiagramCommandPalette";
import { HandleHighlightProvider } from "./contexts/HandleHighlightContext";
import { useCanvasController } from "./hooks/useCanvasController";
import { resolveSceneSnapshot } from "@/features/diagram";
import { CANVAS_STYLES } from "./canvas.constants";
import { canvasEdgeTypes } from "./reactFlowConfig";
import type { CanvasProps } from "./canvas.types";

const Canvas = (props: CanvasProps = {}) => {
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
    handleSelectDiagram,
    handleSearchSelect,
    focusTitleTrigger,
    isPanelOpen,
    selectedNodes,
    selectedCount,
    showElementPanel,
    onDrillUp,
  } = useCanvasController(props);

  if (!diagram) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        {t("canvas.noDiagramSelected")}
      </div>
    );
  }

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
          <div className="absolute top-4 right-4 z-10">
            <SceneToolbarStrip />
          </div>
          <CanvasToolbar
            onDrillUp={onDrillUp}
            isPanelOpen={isPanelOpen}
            selectedCount={selectedCount}
            onClearSelection={visualState.clearCanvasSelection}
          />
          {showSearch && diagram && (
            <CanvasSearch
              onClose={() => setShowSearch(false)}
              onSelectResult={handleSearchSelect}
              components={
                resolveSceneSnapshot(diagram, diagram.activeSceneId ?? null).components
              }
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
          <div onContextMenu={(e) => e.preventDefault()} className="w-full h-full">
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
              nodesDraggable={!isRecording}
              nodesConnectable={!isRecording}
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
