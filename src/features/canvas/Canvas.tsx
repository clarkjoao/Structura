import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  useActiveDiagram,
  useDiagrams,
  useVisibleComponents,
  useVisibleConnections,
  useServiceRegistry,
  useDiagramActions,
  useFlows,
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
  const diagram = useActiveDiagram();
  const allDiagrams = useDiagrams();
  const visibleComponents = useVisibleComponents();
  const visibleConnections = useVisibleConnections();
  const serviceRegistry = useServiceRegistry();
  const flows = useFlows();
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
  } = useDiagramActions();
  const navigate = useNavigate();
  const reactFlowInstance = useReactFlow();
  const reactFlowWrapperRef = useRef<HTMLDivElement>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [highlightedConnectionId, setHighlightedConnectionId] = useState<
    string | null
  >(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(
    new Set(),
  );
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    elementId: string;
  } | null>(null);
  const [quickInsert, setQuickInsert] = useState<{
    screenPos: { x: number; y: number };
    flowPos: { x: number; y: number };
    sourceNodeId: string;
  } | null>(null);
  const [pulseNodeId, setPulseNodeId] = useState<string | null>(null);

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

  const panelIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of visibleComponents) if (isPanelComponent(c)) ids.add(c.id);
    return ids;
  }, [visibleComponents]);

  const connectionCountPerNode = useMemo(() => {
    const counts: Record<string, { incoming: number; outgoing: number }> = {};
    visibleConnections.forEach((conn) => {
      if (!counts[conn.sourceId])
        counts[conn.sourceId] = { incoming: 0, outgoing: 0 };
      if (!counts[conn.targetId])
        counts[conn.targetId] = { incoming: 0, outgoing: 0 };
      counts[conn.sourceId].outgoing += 1;
      counts[conn.targetId].incoming += 1;
    });
    return counts;
  }, [visibleConnections]);

  const edgeHandleAssignments = useMemo(() => {
    const sourceUsage: Record<string, number> = {};
    const targetUsage: Record<string, number> = {};
    const maxHandles = 4;
    return visibleConnections.map((conn) => {
      const outCount = Math.min(
        maxHandles,
        Math.max(1, connectionCountPerNode[conn.sourceId]?.outgoing ?? 1),
      );
      const inCount = Math.min(
        maxHandles,
        Math.max(1, connectionCountPerNode[conn.targetId]?.incoming ?? 1),
      );
      const srcOrder = diagram?.snapshot.components[conn.sourceId]?.handleOrder?.outgoing;
      const tgtOrder = diagram?.snapshot.components[conn.targetId]?.handleOrder?.incoming;
      let sIdx: number;
      if (srcOrder && srcOrder.length > 0) {
        const orderIdx = srcOrder.indexOf(conn.id);
        sIdx = orderIdx !== -1 ? Math.min(orderIdx, outCount - 1) : (sourceUsage[conn.sourceId] ?? 0) % outCount;
      } else {
        sIdx = (sourceUsage[conn.sourceId] ?? 0) % outCount;
      }
      let tIdx: number;
      if (tgtOrder && tgtOrder.length > 0) {
        const orderIdx = tgtOrder.indexOf(conn.id);
        tIdx = orderIdx !== -1 ? Math.min(orderIdx, inCount - 1) : (targetUsage[conn.targetId] ?? 0) % inCount;
      } else {
        tIdx = (targetUsage[conn.targetId] ?? 0) % inCount;
      }
      sourceUsage[conn.sourceId] = (sourceUsage[conn.sourceId] ?? 0) + 1;
      targetUsage[conn.targetId] = (targetUsage[conn.targetId] ?? 0) + 1;
      return {
        connId: conn.id,
        sourceHandle: `source-${sIdx}`,
        targetHandle: `target-${tIdx}`,
      };
    });
  }, [visibleConnections, connectionCountPerNode, diagram]);

  const effectiveHandleOrder = useMemo(() => {
    const result: Record<string, { incoming: string[]; outgoing: string[] }> = {};
    for (const a of edgeHandleAssignments) {
      const conn = visibleConnections.find((c) => c.id === a.connId);
      if (!conn) continue;
      const sIdx = parseInt(a.sourceHandle.split("-")[1]);
      const tIdx = parseInt(a.targetHandle.split("-")[1]);
      if (!result[conn.sourceId]) result[conn.sourceId] = { incoming: [], outgoing: [] };
      if (!result[conn.targetId]) result[conn.targetId] = { incoming: [], outgoing: [] };
      result[conn.sourceId].outgoing[sIdx] = conn.id;
      result[conn.targetId].incoming[tIdx] = conn.id;
    }
    return result;
  }, [edgeHandleAssignments, visibleConnections]);

  const { isPlaying, activeStep, flowHighlight, coverage, recordingInfo } =
    useFlowState({
      activeFlow,
      currentStep,
      flows,
      isRecording,
      recordingSteps,
    });

  // Ref holds the nodes from the previous render so useNodeDragParenting callbacks
  // always have accurate panel bounds without a circular dependency on useCanvasNodes.
  const nodesRef = useRef<import("@xyflow/react").Node[]>([]);

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

  const setHighlight = useCallback(
    (connectionId: string, nodeIds: string[]) => {
      setHighlightedConnectionId(connectionId);
      setHighlightedNodeIds(new Set(nodeIds));
    },
    [],
  );

  const clearHighlight = useCallback(() => {
    setHighlightedConnectionId(null);
    setHighlightedNodeIds(new Set());
  }, []);

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
  }, [isPlaying, clearHighlight, reactFlowInstance]);

  const nodes = useCanvasNodes({
    diagram,
    visibleComponents,
    panelIds,
    selectedNodeId,
    selectedNodeIds,
    highlightedNodeIds,
    serviceRegistry: serviceRegistry ?? {},
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

  // Local drag position overrides for real-time visual feedback without hitting the store on every frame
  const [dragPositions, setDragPositions] = useState<
    Record<string, { x: number; y: number }>
  >({});

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
    [innerOnNodesChange],
  );

  const onNodeDragStop = useCallback(
    (_: unknown, draggedNode: Node) => {
      setDragPositions({});
      innerOnNodeDragStop(_, draggedNode);
    },
    [innerOnNodeDragStop],
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

  const selectedNodes = useMemo(
    () => nodes.filter((n) => selectedNodeIds.has(n.id)),
    [nodes, selectedNodeIds],
  );
  const selectedCount = selectedNodeIds.size;

  const onEdgesChange: OnEdgesChange = useCallback((_changes) => {}, []);
  const onMoveEnd = useCallback(
    (_: unknown, vp: { x: number; y: number; zoom: number }) => {
      updateViewport(vp);
    },
    [updateViewport],
  );
  const onConnect: OnConnect = useCallback(
    (c: Connection) => {
      if (c.source && c.target) addConnection(c.source, c.target, "Usa");
    },
    [addConnection],
  );

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      if (isRecording) return;
      if (connectionState.fromNode === null || connectionState.toNode !== null)
        return;
      if (!(event instanceof MouseEvent)) return;
      const flowPos = reactFlowInstance.screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      setQuickInsert({
        screenPos: { x: event.clientX, y: event.clientY },
        flowPos,
        sourceNodeId: connectionState.fromNode.id,
      });
    },
    [isRecording, reactFlowInstance],
  );

  const handleQuickInsert = useCallback(
    (newNodeId: string) => {
      setQuickInsert(null);
      setPulseNodeId(newNodeId);
      void reactFlowInstance.fitView({
        nodes: [{ id: newNodeId }],
        duration: 500,
        padding: 0.5,
        maxZoom: 1.5,
      });
      setTimeout(() => setPulseNodeId(null), 1500);
    },
    [reactFlowInstance],
  );

  const clearCanvasSelection = useCallback(() => {
    clearHighlight();
    setSelectedNodeId(null);
    setSelectedNodeIds(new Set());
    setSelectedEdgeId(null);
    setContextMenu(null);
  }, [clearHighlight]);

  const onNodeClick = useCallback(
    (e: React.MouseEvent, node: Node) => {
      if (isRecording) {
        if (node.type !== "panel" && node.type !== "note")
          onRecordNodeClick?.(node.id);
        return;
      }
      if (isPlaying) return;
      clearHighlight();
      setSelectedEdgeId(null);
      setContextMenu(null);
      if (e.metaKey || e.ctrlKey) {
        setSelectedNodeIds((prev) => {
          const next = new Set(prev);
          if (next.has(node.id)) next.delete(node.id);
          else next.add(node.id);
          setSelectedNodeId(
            next.size === 0
              ? null
              : next.has(node.id)
                ? node.id
                : (next.values().next().value ?? null),
          );
          return next;
        });
      } else {
        setSelectedNodeIds(new Set([node.id]));
        setSelectedNodeId(node.id);
      }
    },
    [clearHighlight, isPlaying, isRecording, onRecordNodeClick],
  );

  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (isRecording) {
        onRecordEdgeClick?.(edge.id, edge.sourceHandle ?? undefined);
        return;
      }
      clearHighlight();
      setSelectedEdgeId(edge.id);
      setSelectedNodeId(null);
      setSelectedNodeIds(new Set());
      setContextMenu(null);
    },
    [clearHighlight, isRecording, onRecordEdgeClick],
  );

  const onSelectionChange = useCallback(
    ({ nodes: updatedNodes }: { nodes: Node[]; edges: Edge[] }) => {
      const ids = new Set(
        updatedNodes.filter((n) => n.selected).map((n) => n.id),
      );
      setSelectedNodeIds(ids);
      setSelectedNodeId(updatedNodes.find((n) => n.selected)?.id ?? null);
    },
    [],
  );

  const onPaneClick = useCallback(() => {
    clearCanvasSelection();
  }, [clearCanvasSelection]);

  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (isRecording) return;
      event.preventDefault();
      clearHighlight();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        elementId: node.id,
      });
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
    },
    [clearHighlight, isRecording],
  );

  const closePanel = useCallback(() => {
    clearHighlight();
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, [clearHighlight]);

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

  // Focus the canvas on the element referenced by the current flow step.
  // Fires on every step change (including the initial step when playback starts).
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
  }, [activeFlow, currentStep, reactFlowInstance]);

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
      {(selectedNodeId || selectedEdgeId || selectedCount > 0) &&
        !isRecording && (
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
