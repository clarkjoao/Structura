import { useCallback, useEffect, useMemo, useRef } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useReactFlow,
  PanOnScrollMode,
  SelectionMode,
  type Node,
  type Edge,
  type OnEdgesChange,
  type OnConnect,
  type OnConnectEnd,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useNavigate } from "react-router-dom";
import {
  useDiagramActions,
  isPanelComponent,
  type FlowStep,
} from "@/features/diagram";
import CustomEdge from "./edges/CustomEdge";
import CanvasToolbar from "./toolbar/CanvasToolbar";
import ElementPanel from "./ElementPanel/index";
import NodeContextMenu from "./NodeContextMenu";
import { nodeTypes } from "./node-types";
import { useCanvasKeyboard } from "./hooks/useCanvasKeyboard";
import { useNodeDragParenting } from "./hooks/useNodeDragParenting";
import { useFlowState } from "./hooks/useFlowState";
import { useCanvasNodes } from "./hooks/useCanvasNodes";
import { useCanvasEdges } from "./hooks/useCanvasEdges";
import { useCanvasStore } from "./hooks/useCanvasStore";
import { useCanvasVisualState } from "./hooks/useCanvasVisualState";
import { useCanvasConnectionDerivations } from "./hooks/useCanvasConnectionDerivations";
import { useCanvasEventHandlers } from "./hooks/useCanvasEventHandlers";
import QuickInsertPopover from "./QuickInsertPopover";
import { HandleHighlightProvider } from "./contexts/HandleHighlightContext";

const edgeTypes = { c4: CustomEdge };

interface CanvasProps {
  activeFlow?: import("@/features/diagram").Flow | null;
  currentStep?: number;
  onOpenDiagram?: (id: string) => void;
  onDrillUp?: () => void;
  isRecording?: boolean;
  recordingSteps?: FlowStep[];
  onRecordNodeClick?: (nodeId: string) => void;
  onRecordEdgeClick?: (edgeId: string, handleId?: string) => void;
  onRecordHandleClick?: (nodeId: string, handleId: string) => void;
  onRecordUndo?: () => void;
  isViewingCoverage?: boolean;
}

const Canvas = ({
  activeFlow,
  currentStep,
  onOpenDiagram,
  onDrillUp,
  isRecording,
  recordingSteps,
  onRecordNodeClick,
  onRecordEdgeClick,
  onRecordHandleClick,
  onRecordUndo,
  isViewingCoverage,
}: CanvasProps = {}) => {
  const navigate = useNavigate();
  const reactFlowInstance = useReactFlow();
  const reactFlowWrapperRef = useRef<HTMLDivElement>(null);

  // ── Store (dados do diagrama) ─────────────────────────────────────────────
  const {
    diagram,
    allDiagrams,
    visibleComponents,
    visibleConnections,
    serviceRegistry,
    flows,
    actions,
  } = useCanvasStore();

  const {
    updateNodeLayout,
    updateViewport,
    addConnection,
    bringToFront,
    sendToBack,
    openDiagram,
    updateComponent,
    setParent,
    removeComponent,
    undo,
    redo,
    addComponent,
    groupNodes,
    ungroupNodes,
    copyToClipboard,
    pasteFromClipboard,
    clearClipboard,
    updateHandleOrder,
  } = actions;

  // ── Estado visual (seleção, highlight, menus) ────────────────────────────
  const visualState = useCanvasVisualState();
  const {
    selectedNodeId,
    setSelectedNodeId,
    selectedNodeIds,
    setSelectedNodeIds,
    selectedEdgeId,
    setSelectedEdgeId,
    highlightedConnectionId,
    highlightedNodeIds,
    setHighlight,
    clearHighlight,
    contextMenu,
    setContextMenu,
    quickInsert,
    setQuickInsert,
    pulseNodeId,
    setPulseNodeId,
    dragPositions,
    setDragPositions,
    clearCanvasSelection,
  } = visualState;

  // ── Derivados de connections ────────────────────────────────────────────
  const { panelIds, connectionCountPerNode, edgeHandleAssignments, effectiveHandleOrder } =
    useCanvasConnectionDerivations({ visibleComponents, visibleConnections, diagram });

  // ── Flow state (playback, recording, coverage) ───────────────────────────
  const { isPlaying, activeStep, flowHighlight, coverage, recordingInfo } = useFlowState({
    activeFlow,
    currentStep,
    flows,
    isRecording,
    recordingSteps,
  });

  // ── Handlers de drill/navegação (usados por useCanvasNodes) ──────────────
  const handleDrillDown = useCallback(
    (elementId: string) => {
      if (!diagram) return;
      const comp = diagram.snapshot.components[elementId];
      if (comp?.linkedDiagramId && allDiagrams[comp.linkedDiagramId]) {
        if (onOpenDiagram) onOpenDiagram(comp.linkedDiagramId);
        else {
          openDiagram(comp.linkedDiagramId);
          navigate(`/model/${comp.linkedDiagramId}`);
        }
      }
    },
    [diagram, allDiagrams, openDiagram, navigate, onOpenDiagram],
  );

  const handlePanelCollapseToggle = useCallback(
    (panelId: string) => {
      if (!diagram) return;
      const comp = diagram.snapshot.components[panelId];
      if (!isPanelComponent(comp)) return;
      const layout = diagram.nodeLayouts.find((nl) => nl.elementId === panelId);
      const children = Object.values(diagram.snapshot.components).filter(
        (c) => c.parentId === panelId,
      );
      if (comp.collapsed) {
        updateComponent(panelId, {
          collapsed: false,
          width: comp.collapsedWidth ?? 600,
          height: comp.collapsedHeight ?? 400,
        });
        children.forEach((c) => updateComponent(c.id, { hidden: false }));
      } else {
        updateComponent(panelId, {
          collapsed: true,
          collapsedWidth: layout?.width,
          collapsedHeight: layout?.height,
          width: 200,
          height: 60,
        });
        children.forEach((c) => updateComponent(c.id, { hidden: true }));
      }
    },
    [diagram, updateComponent],
  );

  const onReorderHandle = useCallback(
    (
      nodeId: string,
      side: "incoming" | "outgoing",
      connId: string,
      direction: "up" | "down",
    ) => {
      if (isRecording) return;
      const currentOrder = effectiveHandleOrder[nodeId]?.[side] ?? [];
      const idx = currentOrder.indexOf(connId);
      if (idx === -1) return;
      const newOrder = [...currentOrder];
      const swapIdx = direction === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= newOrder.length) return;
      [newOrder[idx], newOrder[swapIdx]] = [newOrder[swapIdx], newOrder[idx]];
      updateHandleOrder(nodeId, side, newOrder);
    },
    [isRecording, effectiveHandleOrder, updateHandleOrder],
  );

  // ── Node drag parenting ─────────────────────────────────────────────────
  const nodesRef = useRef<Node[]>([]);
  const {
    dragTargetPanelId,
    unparentCandidatePanelId,
    onNodesChange: innerOnNodesChange,
    onNodeDragStop: innerOnNodeDragStop,
  } = useNodeDragParenting({
    diagram,
    nodes: nodesRef.current,
    updateNodeLayout,
    setParent,
  });

  // ── Nodes e edges (adaptadores ReactFlow) ─────────────────────────────────
  const nodes = useCanvasNodes({
    diagram,
    visibleComponents,
    panelIds,
    selectedNodeId,
    selectedNodeIds,
    highlightedNodeIds,
    serviceRegistry,
    allDiagrams,
    handleDrillDown,
    handlePanelCollapseToggle,
    isPlaying,
    isRecording: !!isRecording,
    onRecordHandleClick,
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
  nodesRef.current = nodes;

  const renderNodes = useMemo(() => {
    if (Object.keys(dragPositions).length === 0 && !pulseNodeId) return nodes;
    return nodes.map((n) => {
      const dp = dragPositions[n.id];
      const isPulsing = n.id === pulseNodeId;
      if (!dp && !isPulsing) return n;
      return {
        ...n,
        ...(dp ? { position: dp } : {}),
        ...(isPulsing
          ? { className: [n.className, "node-pulse"].filter(Boolean).join(" ") }
          : {}),
      };
    });
  }, [nodes, dragPositions, pulseNodeId]);

  const onNodesChange = useCallback(
    (changes: Parameters<typeof innerOnNodesChange>[0]) => {
      const overrides: Record<string, { x: number; y: number }> = {};
      let hasDragEnd = false;
      for (const c of changes) {
        if (c.type === "position" && c.position) {
          if (c.dragging) overrides[c.id] = c.position;
          else hasDragEnd = true;
        }
      }
      if (Object.keys(overrides).length > 0) {
        setDragPositions((prev) => ({ ...prev, ...overrides }));
      }
      if (hasDragEnd) setDragPositions({});
      innerOnNodesChange(changes);
    },
    [innerOnNodesChange, setDragPositions],
  );

  const onNodeDragStop = useCallback(
    (_: unknown, draggedNode: Node) => {
      setDragPositions({});
      innerOnNodeDragStop(_, draggedNode);
    },
    [innerOnNodeDragStop, setDragPositions],
  );

  const edges = useCanvasEdges({
    diagram,
    visibleConnections,
    edgeHandleAssignments,
    selectedEdgeId,
    isPlaying,
    isRecording,
    activeStep,
    flowHighlight,
    recordingInfo,
    coverage,
  });

  // ── Event handlers ──────────────────────────────────────────────────────
  const {
    onEdgesChange,
    onMoveEnd,
    onConnect,
    onConnectEnd,
    onNodeClick,
    onEdgeClick,
    onSelectionChange,
    onPaneClick,
    onNodeContextMenu,
    handleQuickInsert,
    closePanel,
  } = useCanvasEventHandlers({
    visualState,
    isPlaying,
    isRecording,
    updateViewport,
    addConnection,
    onRecordNodeClick,
    onRecordEdgeClick,
    screenToFlowPosition: (pos) => reactFlowInstance.screenToFlowPosition(pos),
    fitView: async (opts) => {
      await reactFlowInstance.fitView(opts);
    },
  });

  // ── Keyboard shortcuts ───────────────────────────────────────────────────
  const isPanelOpen = !!(selectedNodeId || selectedEdgeId) && !isRecording;
  useCanvasKeyboard({
    diagram,
    selectedNodeId,
    reactFlowInstance,
    reactFlowWrapperRef,
    isRecording,
    onRecordUndo,
    setSelectedNodeId,
    setSelectedNodeIds,
    setSelectedEdgeId,
    setContextMenu: () => setContextMenu(null),
    undo,
    redo,
    removeComponent,
    groupNodes,
    ungroupNodes,
    copyToClipboard,
    pasteFromClipboard,
    clearClipboard,
    addComponent,
    isPanelOpen,
  });

  // ── Effects ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!isPlaying) return;
    clearHighlight();
    setSelectedNodeId(null);
    setSelectedNodeIds(new Set());
    setSelectedEdgeId(null);
    setContextMenu(null);
    reactFlowInstance.setNodes((nodes) =>
      nodes.map((node) => ({ ...node, selected: false })),
    );
  }, [isPlaying, clearHighlight, setSelectedNodeId, setSelectedNodeIds, setSelectedEdgeId, setContextMenu, reactFlowInstance]);

  useEffect(() => {
    const el = document.querySelector(".react-flow__renderer");
    if (!el || !diagram) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { x, y, zoom } = reactFlowInstance.getViewport();
      if (e.ctrlKey || e.metaKey) {
        const d = e.deltaY > 0 ? 0.9 : 1.1;
        reactFlowInstance.setViewport(
          { x, y, zoom: Math.min(4, Math.max(0.1, zoom * d)) },
          { duration: 0 },
        );
      } else if (e.shiftKey) {
        reactFlowInstance.setViewport(
          { x: x - e.deltaY, y, zoom },
          { duration: 0 },
        );
      } else {
        reactFlowInstance.setViewport(
          { x, y: y - e.deltaY, zoom },
          { duration: 0 },
        );
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [reactFlowInstance, diagram]);

  useEffect(() => {
    if (!activeFlow) return;
    const step = activeFlow.steps[currentStep ?? 0];
    if (!step) return;

    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    if (step.componentId) {
      const node = reactFlowInstance.getNode(step.componentId);
      if (node) {
        void reactFlowInstance.fitView({
          nodes: [{ id: step.componentId }],
          duration: 400,
          padding: 0.35,
          maxZoom: 1.5,
        });
        setPulseNodeId(step.componentId);
        timeoutId = setTimeout(() => setPulseNodeId(null), 1500);
      }
    } else if (step.connectionId) {
      const edge = reactFlowInstance.getEdge(step.connectionId);
      if (edge) {
        const srcNode = reactFlowInstance.getNode(edge.source);
        const tgtNode = reactFlowInstance.getNode(edge.target);
        if (srcNode && tgtNode) {
          const sx = srcNode.position.x + (srcNode.measured?.width ?? 160) / 2;
          const sy = srcNode.position.y + (srcNode.measured?.height ?? 80) / 2;
          const tx = tgtNode.position.x + (tgtNode.measured?.width ?? 160) / 2;
          const ty = tgtNode.position.y + (tgtNode.measured?.height ?? 80) / 2;
          const { zoom } = reactFlowInstance.getViewport();
          void reactFlowInstance.setCenter((sx + tx) / 2, (sy + ty) / 2, {
            duration: 400,
            zoom: Math.min(Math.max(zoom, 0.8), 1.5),
          });
        }
      }
    }

    return () => {
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    };
  }, [activeFlow, currentStep, reactFlowInstance, setPulseNodeId]);

  // ── Render ──────────────────────────────────────────────────────────────
  const selectedNodes = useMemo(
    () => nodes.filter((n) => selectedNodeIds.has(n.id)),
    [nodes, selectedNodeIds],
  );
  const selectedCount = selectedNodeIds.size;

  if (!diagram)
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Nenhum diagrama selecionado
      </div>
    );

  return (
    <HandleHighlightProvider
      value={{
        highlightedConnectionId,
        highlightedNodeIds,
        setHighlight,
        clearHighlight,
      }}
    >
      <div className="flex-1 flex relative">
        <style>{`
          .react-flow__pane { cursor: default; }
          .react-flow__pane:active { cursor: grabbing; }
          .react-flow__selection { background: rgba(59, 130, 246, 0.08); border: 1px solid #3b82f6; }
          @keyframes quick-insert-pulse {
            0%   { box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.7); }
            100% { box-shadow: 0 0 0 0px rgba(99, 102, 241, 0); }
          }
          .node-pulse { animation: quick-insert-pulse 0.45s ease-out 3; }
        `}</style>
        <div ref={reactFlowWrapperRef} className="flex-1 relative">
          <CanvasToolbar
            onDrillUp={onDrillUp}
            isPanelOpen={isPanelOpen}
            selectedCount={selectedCount}
            onClearSelection={clearCanvasSelection}
          />
          <div
            onContextMenu={(e) => e.preventDefault()}
            className="w-full h-full"
          >
            <ReactFlow
              nodes={renderNodes}
              edges={edges}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onConnectEnd={onConnectEnd}
              onNodeClick={onNodeClick}
              onEdgeClick={onEdgeClick}
              onPaneClick={onPaneClick}
              onPaneContextMenu={(e) => e.preventDefault()}
              onNodeContextMenu={onNodeContextMenu}
              onNodeDragStop={onNodeDragStop}
              onSelectionChange={onSelectionChange}
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
              onMoveEnd={onMoveEnd}
              nodesDraggable={!isRecording}
              nodesConnectable={!isRecording}
              proOptions={{ hideAttribution: true }}
              className="bg-background"
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={20}
                size={1}
                color="hsl(220 20% 18%)"
              />
              <Controls className="!bg-card !border-border !rounded-lg !shadow-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-muted-foreground [&>button:hover]:!bg-surface-hover [&>button]:!rounded-md [&>button]:!w-8 [&>button]:!h-8" />
            </ReactFlow>
          </div>
        </div>
        {contextMenu && (
          <NodeContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            elementId={contextMenu.elementId}
            onBringToFront={bringToFront}
            onSendToBack={sendToBack}
            onClose={() => setContextMenu(null)}
          />
        )}
        {quickInsert && (
          <QuickInsertPopover
            screenPos={quickInsert.screenPos}
            flowPos={quickInsert.flowPos}
            sourceNodeId={quickInsert.sourceNodeId}
            onInsert={handleQuickInsert}
            onClose={() => setQuickInsert(null)}
          />
        )}
        {(selectedNodeId || selectedEdgeId || selectedCount > 0) && !isRecording && (
          <div className="absolute inset-y-0 right-0 z-20 flex">
            <ElementPanel
              key={selectedNodeId ?? selectedEdgeId ?? "multi"}
              selectedElementId={selectedNodeId}
              selectedEdgeId={selectedEdgeId}
              selectedNodeIds={Array.from(selectedNodeIds)}
              selectedNodes={selectedNodes}
              onClose={closePanel}
            />
          </div>
        )}
      </div>
    </HandleHighlightProvider>
  );
};

export default Canvas;
