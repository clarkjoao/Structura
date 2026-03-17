import { useRef, useEffect, useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useReactFlow,
  useUpdateNodeInternals,
  PanOnScrollMode,
  SelectionMode,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useNavigate } from "react-router-dom";
import CustomEdge from "./edges/CustomEdge";
import CanvasToolbar from "./toolbar/CanvasToolbar";
import ElementPanel from "./panels/ElementPanel/index";
import NodeContextMenu from "./panels/NodeContextMenu";
import { nodeTypes } from "./nodes/node-types";
import { useCanvasKeyboard } from "./hooks/useCanvasKeyboard";
import { useNodeDragParenting } from "./hooks/useNodeDragParenting";
import { useFlowState } from "./flow/useFlowState";
import { useCanvasNodes } from "./nodes/useCanvasNodes";
import { useCanvasEdges } from "./edges/useCanvasEdges";
import { useCanvasStore } from "./hooks/useCanvasStore";
import { useCanvasVisualState } from "./hooks/useCanvasVisualState";
import { useCanvasConnectionDerivations } from "./edges/useCanvasConnectionDerivations";
import { useCanvasEventHandlers } from "./hooks/useCanvasEventHandlers";
import { useCanvasDrillHandlers } from "./hooks/useCanvasDrillHandlers";
import { useCanvasHandleReorder } from "./edges/useCanvasHandleReorder";
import { useCanvasEffects } from "./hooks/useCanvasEffects";
import { useLocalNodes } from "./hooks/useLocalNodes";
import { useConnectionInternalsSync } from "./hooks/useConnectionInternalsSync";
import QuickInsertPopover from "./toolbar/QuickInsertPopover";
import CanvasSearch from "./toolbar/CanvasSearch";
import { HandleHighlightProvider } from "./contexts/HandleHighlightContext";
import { useRecordingMode } from "./flow/RecordingModeContext";

const edgeTypes = { c4: CustomEdge };

interface CanvasProps {
  onOpenDiagram?: (id: string) => void;
  onDrillUp?: () => void;
  isViewingCoverage?: boolean;
  isFlowPanelOpen?: boolean;
  onPlayFlow?: (flowId: string) => void;
}

const CANVAS_STYLES = `
  .react-flow__pane { cursor: default; }
  .react-flow__pane:active { cursor: grabbing; }
  .react-flow__selection { background: rgba(59, 130, 246, 0.08); border: 1px solid #3b82f6; }
  .react-flow__background pattern circle { fill: hsl(var(--grid-line)); }
`;

const Canvas = ({
  onOpenDiagram,
  onDrillUp,
  isViewingCoverage,
  isFlowPanelOpen,
  onPlayFlow,
}: CanvasProps = {}) => {
  const navigate = useNavigate();
  const reactFlowInstance = useReactFlow();
  const updateNodeInternals = useUpdateNodeInternals();
  const reactFlowWrapperRef = useRef<HTMLDivElement>(null);
  const { isRecording } = useRecordingMode();
  const [showSearch, setShowSearch] = useState(false);
  const [focusTitleTrigger, setFocusTitleTrigger] = useState(0);

  const { diagram, allDiagrams, visibleComponents, visibleConnections, serviceRegistry, flows, actions } =
    useCanvasStore();
  const visualState = useCanvasVisualState();
  const { panelIds, connectionCountPerNode, edgeHandleAssignments, effectiveHandleOrder } =
    useCanvasConnectionDerivations({ visibleComponents, visibleConnections, diagram });
  const { isPlaying, activeStep, flowHighlight, coverage, recordingInfo, activeFlow, currentStep } = useFlowState({
    flows,
  });

  const { handleDrillDown, handlePanelCollapseToggle } = useCanvasDrillHandlers({
    diagram,
    allDiagrams,
    updateComponent: actions.updateComponent,
    openDiagram: actions.openDiagram,
    navigate,
    onOpenDiagram,
  });

  const handleAddEndpointToGroup = useCallback(
    (groupId: string) => {
      actions.addComponent("endpoint", "Novo Endpoint", groupId);
    },
    [actions],
  );

  const { onReorderHandle } = useCanvasHandleReorder({
    effectiveHandleOrder,
    updateHandleOrder: actions.updateHandleOrder,
  });

  const localNodesRef = useRef<Node[]>([]);

  const { dragTargetPanelId, unparentCandidatePanelId, onNodesChange: innerOnNodesChange, onNodeDragStop } =
    useNodeDragParenting({
      diagram,
      nodes: localNodesRef.current,
      updateNodeLayout: actions.updateNodeLayout,
      setParent: actions.setParent,
    });

  const storeNodes = useCanvasNodes({
    diagram,
    visibleComponents,
    panelIds,
    selectedNodeId: visualState.selectedNodeId,
    selectedNodeIds: visualState.selectedNodeIds,
    highlightedNodeIds: visualState.highlightedNodeIds,
    serviceRegistry,
    allDiagrams,
    handleDrillDown,
    handlePanelCollapseToggle,
    isPlaying,
    dragTargetPanelId,
    unparentCandidatePanelId,
    connectionCountPerNode,
    effectiveHandleOrder,
    onReorderHandle,
    flowHighlight,
    activeStep,
    recordingInfo,
    coverage,
    isViewingCoverage: !!isViewingCoverage,
    activeFlowId: activeFlow?.id ?? null,
    onPlayFlow,
    onAddEndpointToGroup: handleAddEndpointToGroup,
  });

  const onSelectionFromChanges = useCallback(
    (selectedIds: string[]) => {
      if (selectedIds.length === 0) return;
      visualState.setSelectedEdgeId(null);
      visualState.setContextMenu(null);
      visualState.setSelectedNodeIds(new Set(selectedIds));
      visualState.setSelectedNodeId(selectedIds[0] ?? null);
    },
    [visualState],
  );

  const { nodes, onNodesChange } = useLocalNodes(
    storeNodes,
    innerOnNodesChange,
    localNodesRef,
    onSelectionFromChanges,
  );

  const edges = useCanvasEdges({
    diagram,
    visibleConnections,
    edgeHandleAssignments,
    selectedEdgeId: visualState.selectedEdgeId,
    isPlaying,
    activeStep,
    flowHighlight,
    recordingInfo,
    coverage,
  });

  useConnectionInternalsSync(connectionCountPerNode, updateNodeInternals);

  const handleRequestFocusTitle = useCallback(() => {
    setFocusTitleTrigger((t) => t + 1);
  }, []);

  const eventHandlers = useCanvasEventHandlers({
    visualState,
    isPlaying,
    isFlowPanelOpen: !!isFlowPanelOpen,
    updateViewport: actions.updateViewport,
    addConnection: actions.addConnection,
    screenToFlowPosition: (pos) => reactFlowInstance.screenToFlowPosition(pos),
    onRequestFocusTitle: handleRequestFocusTitle,
  });

  const isPanelOpen = !!(visualState.selectedNodeId || visualState.selectedEdgeId) && !isRecording;
  const handleSearchSelect = useCallback(
    (componentId: string) => {
      setShowSearch(false);
      visualState.setSelectedNodeId(componentId);
      visualState.setSelectedNodeIds(new Set([componentId]));
      visualState.setSelectedEdgeId(null);
      void reactFlowInstance.fitView({
        nodes: [{ id: componentId }],
        duration: 400,
        padding: 0.4,
        maxZoom: 1,
      });
    },
    [reactFlowInstance, visualState],
  );

  useCanvasKeyboard({
    diagram,
    serviceRegistry,
    selectedNodeId: visualState.selectedNodeId,
    selectedEdgeId: visualState.selectedEdgeId,
    reactFlowInstance,
    reactFlowWrapperRef,
    setSelectedNodeId: visualState.setSelectedNodeId,
    setSelectedNodeIds: visualState.setSelectedNodeIds,
    setSelectedEdgeId: visualState.setSelectedEdgeId,
    setContextMenu: () => visualState.setContextMenu(null),
    undo: actions.undo,
    redo: actions.redo,
    removeComponent: actions.removeComponent,
    removeConnection: actions.removeConnection,
    groupNodes: actions.groupNodes,
    ungroupNodes: actions.ungroupNodes,
    setParent: actions.setParent,
    updateNodeLayout: actions.updateNodeLayout,
    copyToClipboard: actions.copyToClipboard,
    pasteFromClipboard: actions.pasteFromClipboard,
    clearClipboard: actions.clearClipboard,
    addComponent: actions.addComponent,
    isPanelOpen,
    isFlowPanelOpen: !!isFlowPanelOpen,
    isPlaying,
    isSearchOpen: showSearch,
    onOpenSearch: () => setShowSearch(true),
  });

  useCanvasEffects({
    diagram,
    reactFlowInstance,
    isPlaying,
    activeFlow,
    currentStep,
    onClearSelection: visualState.clearCanvasSelection,
  });

  useEffect(() => {
    if (isFlowPanelOpen) visualState.clearCanvasSelection();
  }, [isFlowPanelOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedNodes = nodes.filter((n) => visualState.selectedNodeIds.has(n.id));
  const selectedCount = visualState.selectedNodeIds.size;
  const showElementPanel =
    (visualState.selectedNodeId || visualState.selectedEdgeId || selectedCount > 0) && !isRecording;

  if (!diagram) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Nenhum diagrama selecionado
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
              components={diagram.snapshot.components}
            />
          )}
          <div onContextMenu={(e) => e.preventDefault()} className="w-full h-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={eventHandlers.onEdgesChange}
              onConnect={eventHandlers.onConnect}
              onConnectEnd={eventHandlers.onConnectEnd}
              onNodeClick={eventHandlers.onNodeClick}
              onEdgeClick={eventHandlers.onEdgeClick}
              onNodeDoubleClick={eventHandlers.onNodeDoubleClick}
              onEdgeDoubleClick={eventHandlers.onEdgeDoubleClick}
              onPaneClick={eventHandlers.onPaneClick}
              onPaneContextMenu={(e) => e.preventDefault()}
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
              maxZoom={1}
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
