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
  activeFlow, currentStep, onOpenDiagram, onDrillUp,
  isRecording, recordingSteps, onRecordNodeClick, onRecordEdgeClick,
  onRecordHandleClick, onRecordUndo, isViewingCoverage,
}: CanvasProps = {}) => {
  const diagram = useActiveDiagram();
  const allDiagrams = useDiagrams();
  const visibleComponents = useVisibleComponents();
  const visibleConnections = useVisibleConnections();
  const serviceRegistry = useServiceRegistry();
  const flows = useFlows();
  const {
    updateNodeLayout, updateViewport, addConnection,
    bringToFront, sendToBack, openDiagram, updateComponent,
    setParent, removeComponent, undo, redo, addComponent,
    groupNodes, ungroupNodes, copyToClipboard, pasteFromClipboard, clearClipboard,
  } = useDiagramActions();
  const navigate = useNavigate();
  const reactFlowInstance = useReactFlow();
  const reactFlowWrapperRef = useRef<HTMLDivElement>(null);

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elementId: string } | null>(null);

  const handleDrillDown = useCallback((elementId: string) => {
    if (!diagram) return;
    const comp = diagram.snapshot.components[elementId];
    if (comp?.linkedDiagramId && allDiagrams[comp.linkedDiagramId]) {
      if (onOpenDiagram) onOpenDiagram(comp.linkedDiagramId);
      else { openDiagram(comp.linkedDiagramId); navigate(`/model/${comp.linkedDiagramId}`); }
    }
  }, [diagram, allDiagrams, openDiagram, navigate, onOpenDiagram]);

  const handlePanelCollapseToggle = useCallback((panelId: string) => {
    if (!diagram) return;
    const comp = diagram.snapshot.components[panelId];
    if (!isPanelComponent(comp)) return;
    const layout = diagram.nodeLayouts.find((nl) => nl.elementId === panelId);
    const children = Object.values(diagram.snapshot.components).filter((c) => c.parentId === panelId);
    if (comp.collapsed) {
      updateComponent(panelId, { collapsed: false, width: comp.collapsedWidth ?? 600, height: comp.collapsedHeight ?? 400 });
      children.forEach((c) => updateComponent(c.id, { hidden: false }));
    } else {
      updateComponent(panelId, { collapsed: true, collapsedWidth: layout?.width, collapsedHeight: layout?.height, width: 200, height: 60 });
      children.forEach((c) => updateComponent(c.id, { hidden: true }));
    }
  }, [diagram, updateComponent]);

  const panelIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of visibleComponents) if (isPanelComponent(c)) ids.add(c.id);
    return ids;
  }, [visibleComponents]);

  const connectionCountPerNode = useMemo(() => {
    const counts: Record<string, { incoming: number; outgoing: number }> = {};
    visibleConnections.forEach((conn) => {
      if (!counts[conn.sourceId]) counts[conn.sourceId] = { incoming: 0, outgoing: 0 };
      if (!counts[conn.targetId]) counts[conn.targetId] = { incoming: 0, outgoing: 0 };
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
      const outCount = Math.min(maxHandles, Math.max(1, connectionCountPerNode[conn.sourceId]?.outgoing ?? 1));
      const inCount = Math.min(maxHandles, Math.max(1, connectionCountPerNode[conn.targetId]?.incoming ?? 1));
      const sIdx = (sourceUsage[conn.sourceId] ?? 0) % outCount;
      const tIdx = (targetUsage[conn.targetId] ?? 0) % inCount;
      sourceUsage[conn.sourceId] = (sourceUsage[conn.sourceId] ?? 0) + 1;
      targetUsage[conn.targetId] = (targetUsage[conn.targetId] ?? 0) + 1;
      return { connId: conn.id, sourceHandle: `source-${sIdx}`, targetHandle: `target-${tIdx}` };
    });
  }, [visibleConnections, connectionCountPerNode]);

  const { isPlaying, activeStep, flowHighlight, coverage, recordingInfo } =
    useFlowState({ activeFlow, currentStep, flows, isRecording, recordingSteps });

  // Ref holds the nodes from the previous render so useNodeDragParenting callbacks
  // always have accurate panel bounds without a circular dependency on useCanvasNodes.
  const nodesRef = useRef<import("@xyflow/react").Node[]>([]);

  const { dragTargetPanelId, unparentCandidatePanelId, onNodesChange: innerOnNodesChange, onNodeDragStop: innerOnNodeDragStop } =
    useNodeDragParenting({ diagram, nodes: nodesRef.current, updateNodeLayout, setParent });

  const nodes = useCanvasNodes({
    diagram, visibleComponents, panelIds, selectedNodeId, selectedNodeIds,
    serviceRegistry: serviceRegistry ?? {}, allDiagrams, handleDrillDown,
    handlePanelCollapseToggle, isPlaying, isRecording: !!isRecording, onRecordHandleClick,
    dragTargetPanelId, unparentCandidatePanelId, connectionCountPerNode,
    flowHighlight, activeStep, recordingInfo, coverage, isViewingCoverage: !!isViewingCoverage,
  });

  nodesRef.current = nodes;

  // Local drag position overrides for real-time visual feedback without hitting the store on every frame
  const [dragPositions, setDragPositions] = useState<Record<string, { x: number; y: number }>>({});

  const renderNodes = useMemo(() => {
    if (Object.keys(dragPositions).length === 0) return nodes;
    return nodes.map((n) => {
      const dp = dragPositions[n.id];
      return dp ? { ...n, position: dp } : n;
    });
  }, [nodes, dragPositions]);

  const onNodesChange = useCallback((changes: Parameters<typeof innerOnNodesChange>[0]) => {
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
  }, [innerOnNodesChange]);

  const onNodeDragStop = useCallback((_: unknown, draggedNode: Node) => {
    setDragPositions({});
    innerOnNodeDragStop(_, draggedNode);
  }, [innerOnNodeDragStop]);

  const edges = useCanvasEdges({
    diagram, visibleConnections, edgeHandleAssignments, selectedEdgeId,
    isPlaying, isRecording, activeStep, flowHighlight, recordingInfo, coverage,
  });

  const selectedNodes = useMemo(() => nodes.filter((n) => selectedNodeIds.has(n.id)), [nodes, selectedNodeIds]);
  const selectedCount = selectedNodeIds.size;

  const onEdgesChange: OnEdgesChange = useCallback((_changes) => {}, []);
  const onMoveEnd = useCallback((_: unknown, vp: { x: number; y: number; zoom: number }) => { updateViewport(vp); }, [updateViewport]);
  const onConnect: OnConnect = useCallback(
    (c: Connection) => { if (c.source && c.target) addConnection(c.source, c.target, "Usa"); },
    [addConnection],
  );

  const onNodeClick = useCallback((e: React.MouseEvent, node: Node) => {
    if (isRecording) { if (node.type !== "panel" && node.type !== "note") onRecordNodeClick?.(node.id); return; }
    if (isPlaying) return;
    setSelectedEdgeId(null); setContextMenu(null);
    if (e.metaKey || e.ctrlKey) {
      setSelectedNodeIds((prev) => {
        const next = new Set(prev);
        if (next.has(node.id)) next.delete(node.id); else next.add(node.id);
        setSelectedNodeId(next.size === 0 ? null : next.has(node.id) ? node.id : (next.values().next().value ?? null));
        return next;
      });
    } else { setSelectedNodeIds(new Set([node.id])); setSelectedNodeId(node.id); }
  }, [isPlaying, isRecording, onRecordNodeClick]);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    if (isRecording) { onRecordEdgeClick?.(edge.id, edge.sourceHandle ?? undefined); return; }
    setSelectedEdgeId(edge.id); setSelectedNodeId(null); setContextMenu(null);
  }, [isRecording, onRecordEdgeClick]);

  const onSelectionChange = useCallback(({ nodes: updatedNodes }: { nodes: Node[]; edges: Edge[] }) => {
    const ids = new Set(updatedNodes.filter((n) => n.selected).map((n) => n.id));
    setSelectedNodeIds(ids);
    setSelectedNodeId(updatedNodes.find((n) => n.selected)?.id ?? null);
  }, []);

  const onPaneClick = useCallback(() => { setSelectedNodeId(null); setSelectedNodeIds(new Set()); setSelectedEdgeId(null); setContextMenu(null); }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    if (isRecording) return;
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, elementId: node.id });
    setSelectedNodeId(node.id); setSelectedEdgeId(null);
  }, [isRecording]);

  const closePanel = useCallback(() => { setSelectedNodeId(null); setSelectedEdgeId(null); }, []);

  const isPanelOpen = !!(selectedNodeId || selectedEdgeId) && !isRecording;

  useCanvasKeyboard({
    diagram, selectedNodeId, reactFlowInstance, reactFlowWrapperRef,
    isRecording, onRecordUndo, setSelectedNodeId, setSelectedNodeIds,
    setSelectedEdgeId, setContextMenu: () => setContextMenu(null),
    undo, redo, removeComponent, groupNodes, ungroupNodes,
    copyToClipboard, pasteFromClipboard, clearClipboard,
    addComponent, isPanelOpen,
  });

  useEffect(() => {
    const el = document.querySelector(".react-flow__renderer");
    if (!el || !diagram) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const { x, y, zoom } = reactFlowInstance.getViewport();
      if (e.ctrlKey || e.metaKey) {
        const d = e.deltaY > 0 ? 0.9 : 1.1;
        reactFlowInstance.setViewport({ x, y, zoom: Math.min(4, Math.max(0.1, zoom * d)) }, { duration: 0 });
      } else if (e.shiftKey) {
        reactFlowInstance.setViewport({ x: x - e.deltaY, y, zoom }, { duration: 0 });
      } else {
        reactFlowInstance.setViewport({ x, y: y - e.deltaY, zoom }, { duration: 0 });
      }
    };
    el.addEventListener("wheel", handleWheel, { passive: false });
    return () => el.removeEventListener("wheel", handleWheel);
  }, [reactFlowInstance, diagram]);

  if (!diagram) return <div className="flex-1 flex items-center justify-center text-muted-foreground">Nenhum diagrama selecionado</div>;

  return (
    <div className="flex-1 flex relative">
      <style>{`
        .react-flow__pane { cursor: default; }
        .react-flow__pane:active { cursor: grabbing; }
        .react-flow__selection { background: rgba(59, 130, 246, 0.08); border: 1px solid #3b82f6; }
      `}</style>
      <div ref={reactFlowWrapperRef} className="flex-1 relative">
        <CanvasToolbar onDrillUp={onDrillUp} isPanelOpen={isPanelOpen} selectedCount={selectedCount} />
        <div onContextMenu={(e) => e.preventDefault()} className="w-full h-full">
          <ReactFlow
            nodes={renderNodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
            onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
            onNodeClick={onNodeClick} onEdgeClick={onEdgeClick} onPaneClick={onPaneClick}
            onPaneContextMenu={(e) => e.preventDefault()} onNodeContextMenu={onNodeContextMenu}
            onNodeDragStop={onNodeDragStop} onSelectionChange={onSelectionChange}
            panOnDrag={[2]} panOnScroll panOnScrollMode={PanOnScrollMode.Free}
            selectionOnDrag selectionMode={SelectionMode.Partial}
            zoomOnScroll={false} zoomOnPinch zoomOnDoubleClick={false}
            minZoom={0.1} maxZoom={4} multiSelectionKeyCode="Meta"
            defaultViewport={diagram.viewport} fitView fitViewOptions={{ padding: 0.3 }}
            onMoveEnd={onMoveEnd} nodesDraggable={!isRecording} nodesConnectable={!isRecording}
            proOptions={{ hideAttribution: true }} className="bg-background"
          >
            <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(220 20% 18%)" />
            <Controls className="!bg-card !border-border !rounded-lg !shadow-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-muted-foreground [&>button:hover]:!bg-surface-hover [&>button]:!rounded-md [&>button]:!w-8 [&>button]:!h-8" />
          </ReactFlow>
        </div>
      </div>
      {contextMenu && (
        <NodeContextMenu x={contextMenu.x} y={contextMenu.y} elementId={contextMenu.elementId}
          onBringToFront={bringToFront} onSendToBack={sendToBack} onClose={() => setContextMenu(null)} />
      )}
      {(selectedNodeId || selectedEdgeId || selectedCount > 0) && !isRecording && (
        <ElementPanel key={selectedNodeId ?? selectedEdgeId ?? "multi"}
          selectedElementId={selectedNodeId} selectedEdgeId={selectedEdgeId}
          selectedNodeIds={Array.from(selectedNodeIds)} selectedNodes={selectedNodes} onClose={closePanel} />
      )}
    </div>
  );
};

export default Canvas;
