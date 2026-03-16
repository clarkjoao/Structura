import { useRef, useCallback, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useReactFlow,
  PanOnScrollMode,
  SelectionMode,
  applyNodeChanges,
  type Node,
  type OnNodesChange,
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
import QuickInsertPopover from "./toolbar/QuickInsertPopover";
import { HandleHighlightProvider } from "./contexts/HandleHighlightContext";
import { useRecordingMode } from "./flow/RecordingModeContext";

const edgeTypes = { c4: CustomEdge };

interface CanvasProps {
  activeFlow?: import("@/features/diagram").Flow | null;
  currentStep?: number;
  onOpenDiagram?: (id: string) => void;
  onDrillUp?: () => void;
  isViewingCoverage?: boolean;
}

const CANVAS_STYLES = `
  .react-flow__pane { cursor: default; }
  .react-flow__pane:active { cursor: grabbing; }
  .react-flow__selection { background: rgba(59, 130, 246, 0.08); border: 1px solid #3b82f6; }
`;

const Canvas = ({
  activeFlow,
  currentStep,
  onOpenDiagram,
  onDrillUp,
  isViewingCoverage,
}: CanvasProps = {}) => {
  const navigate = useNavigate();
  const reactFlowInstance = useReactFlow();
  const reactFlowWrapperRef = useRef<HTMLDivElement>(null);
  const { isRecording } = useRecordingMode();

  const { diagram, allDiagrams, visibleComponents, visibleConnections, serviceRegistry, flows, actions } =
    useCanvasStore();
  const visualState = useCanvasVisualState();
  const { panelIds, connectionCountPerNode, edgeHandleAssignments, effectiveHandleOrder } =
    useCanvasConnectionDerivations({ visibleComponents, visibleConnections, diagram });
  const { isPlaying, activeStep, flowHighlight, coverage, recordingInfo } = useFlowState({
    activeFlow,
    currentStep,
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

  const { onReorderHandle } = useCanvasHandleReorder({
    effectiveHandleOrder,
    updateHandleOrder: actions.updateHandleOrder,
  });

  const [localNodes, setLocalNodes] = useState<Node[]>([]);
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
  });

  const prevStoreNodesRef = useRef<Node[] | undefined>(undefined);
  if (storeNodes !== prevStoreNodesRef.current) {
    prevStoreNodesRef.current = storeNodes;
    setLocalNodes((prev) => {
      if (prev.length === 0) {
        localNodesRef.current = storeNodes;
        return storeNodes;
      }
      const localMap = new Map(prev.map((n) => [n.id, n]));
      const merged = storeNodes.map((sn) => {
        const ln = localMap.get(sn.id);
        if (!ln) return sn;
        // Spread local first (preserves RF internals like measured/internals + drag position),
        // then store props (data, style, hidden, zIndex, etc.)
        return {
          ...ln,
          data: sn.data,
          style: sn.style,
          hidden: sn.hidden,
          zIndex: sn.zIndex,
          connectable: sn.connectable,
          selected: sn.selected,
          type: sn.type,
          parentId: sn.parentId,
          extent: sn.extent,
        };
      });
      localNodesRef.current = merged;
      return merged;
    });
  }

  const nodes = localNodes;

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      if(!changes.length) return;
      innerOnNodesChange(changes);
      setLocalNodes((nds) => {
        const updated = applyNodeChanges(changes, nds);
        localNodesRef.current = updated;
        return updated;
      });
    },
    [innerOnNodesChange],
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

  const eventHandlers = useCanvasEventHandlers({
    visualState,
    isPlaying,
    updateViewport: actions.updateViewport,
    addConnection: actions.addConnection,
    screenToFlowPosition: (pos) => reactFlowInstance.screenToFlowPosition(pos),
  });

  const isPanelOpen = !!(visualState.selectedNodeId || visualState.selectedEdgeId) && !isRecording;
  useCanvasKeyboard({
    diagram,
    selectedNodeId: visualState.selectedNodeId,
    reactFlowInstance,
    reactFlowWrapperRef,
    setSelectedNodeId: visualState.setSelectedNodeId,
    setSelectedNodeIds: visualState.setSelectedNodeIds,
    setSelectedEdgeId: visualState.setSelectedEdgeId,
    setContextMenu: () => visualState.setContextMenu(null),
    undo: actions.undo,
    redo: actions.redo,
    removeComponent: actions.removeComponent,
    groupNodes: actions.groupNodes,
    ungroupNodes: actions.ungroupNodes,
    copyToClipboard: actions.copyToClipboard,
    pasteFromClipboard: actions.pasteFromClipboard,
    clearClipboard: actions.clearClipboard,
    addComponent: actions.addComponent,
    isPanelOpen,
  });

  useCanvasEffects({
    diagram,
    reactFlowInstance,
    isPlaying,
    activeFlow,
    currentStep,
    onClearSelection: visualState.clearCanvasSelection,
  });

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
              zoomOnDoubleClick={false}
              minZoom={0.1}
              maxZoom={4}
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
              <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(220 20% 18%)" />
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
              onClose={eventHandlers.closePanel}
            />
          </div>
        )}
      </div>
    </HandleHighlightProvider>
  );
};

export default Canvas;
