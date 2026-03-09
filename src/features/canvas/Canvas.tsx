import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useReactFlow,
  MarkerType,
  type Node,
  type Edge,
  type OnNodesChange,
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
  getEffectiveConnectionStyle,
  type FlowStep,
} from "@/features/diagram";
import CustomEdge from "./edges/CustomEdge";
import CanvasToolbar from "./toolbar/CanvasToolbar";
import ElementPanel from "./ElementPanel";
import NodeContextMenu from "./NodeContextMenu";
import {
  nodeTypes,
  getDescriptor,
  PANEL_DEFAULT_W,
  PANEL_DEFAULT_H,
  type NodeBuildContext,
} from "./node-types";

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
}: CanvasProps = {}) => {
  const diagram = useActiveDiagram();
  const allDiagrams = useDiagrams();
  const visibleComponents = useVisibleComponents();
  const visibleConnections = useVisibleConnections();
  const serviceRegistry = useServiceRegistry();
  const {
    updateNodeLayout,
    updateViewport,
    addConnection,
    bringToFront,
    sendToBack,
    openDiagram,
    updateComponent,
    setParent,
    addComponent,
    removeComponent,
    undo,
    redo,
  } = useDiagramActions();
  const navigate = useNavigate();
  const reactFlowInstance = useReactFlow();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    elementId: string;
  } | null>(null);
  const [dragTargetPanelId, setDragTargetPanelId] = useState<string | null>(
    null,
  );
  const dragTargetRef = useRef<string | null>(null);

  const handleDrillDown = useCallback(
    (elementId: string) => {
      if (!diagram) return;
      const comp = diagram.snapshot.components[elementId];
      if (comp?.linkedDiagramId && allDiagrams[comp.linkedDiagramId]) {
        if (onOpenDiagram) {
          onOpenDiagram(comp.linkedDiagramId);
        } else {
          openDiagram(comp.linkedDiagramId);
          navigate(`/model/${comp.linkedDiagramId}`);
        }
      }
    },
    [diagram, allDiagrams, openDiagram, navigate, onOpenDiagram],
  );

  const panelIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of visibleComponents) {
      if (c.type === "panel") ids.add(c.id);
    }
    return ids;
  }, [visibleComponents]);

  const isPlaying =
    !!activeFlow && currentStep !== undefined && currentStep >= 0;

  const activeStep = isPlaying && activeFlow ? activeFlow.steps[currentStep!] : null;

  const flowHighlight = useMemo(() => {
    if (!isPlaying || !activeFlow)
      return {
        activeNodeId: null as string | null,
        activeConnId: null as string | null,
        visitedNodeIds: new Set<string>(),
        participantNodeIds: new Set<string>(),
        participantConnIds: new Set<string>(),
      };
    const step = activeFlow.steps[currentStep!];
    const visitedNodeIds = new Set<string>();
    const participantNodeIds = new Set<string>();
    const participantConnIds = new Set<string>();
    for (const s of activeFlow.steps) {
      if (s.componentId) participantNodeIds.add(s.componentId);
      if (s.connectionId) participantConnIds.add(s.connectionId);
      if (s.order < (currentStep ?? 0) && s.componentId)
        visitedNodeIds.add(s.componentId);
    }
    return {
      activeNodeId: step?.componentId ?? null,
      activeConnId: step?.connectionId ?? null,
      visitedNodeIds,
      participantNodeIds,
      participantConnIds,
    };
  }, [isPlaying, activeFlow, currentStep]);

  const flows = useFlows();

  const coverage = useMemo(() => {
    if (isPlaying || isRecording) return null;
    const nodeFlows = new Map<string, string[]>();
    const edgeFlows = new Map<string, string[]>();
    for (const flow of flows) {
      for (const step of flow.steps) {
        if (step.componentId) {
          const arr = nodeFlows.get(step.componentId) ?? [];
          if (!arr.includes(flow.name)) arr.push(flow.name);
          nodeFlows.set(step.componentId, arr);
        }
        if (step.connectionId) {
          const arr = edgeFlows.get(step.connectionId) ?? [];
          if (!arr.includes(flow.name)) arr.push(flow.name);
          edgeFlows.set(step.connectionId, arr);
        }
      }
    }
    return { nodeFlows, edgeFlows };
  }, [flows, isPlaying, isRecording]);

  const recordingInfo = useMemo(() => {
    if (!isRecording || !recordingSteps?.length) return null;
    const nodeSteps = new Map<string, number[]>();
    const edgeSteps = new Map<string, number[]>();
    const recordedNodeIds = new Set<string>();
    const recordedEdgeIds = new Set<string>();

    for (const step of recordingSteps) {
      if (step.componentId) {
        recordedNodeIds.add(step.componentId);
        const arr = nodeSteps.get(step.componentId) ?? [];
        arr.push(step.order + 1);
        nodeSteps.set(step.componentId, arr);
      }
      if (step.connectionId) {
        recordedEdgeIds.add(step.connectionId);
        const arr = edgeSteps.get(step.connectionId) ?? [];
        arr.push(step.order + 1);
        edgeSteps.set(step.connectionId, arr);
      }
    }

    const lastStep = recordingSteps[recordingSteps.length - 1];
    return {
      nodeSteps,
      edgeSteps,
      recordedNodeIds,
      recordedEdgeIds,
      lastNodeId: lastStep?.componentId ?? null,
      lastEdgeId: lastStep?.connectionId ?? null,
      lastHandleId: lastStep?.handleId ?? null,
    };
  }, [isRecording, recordingSteps]);

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
      const sKey = conn.sourceId;
      const tKey = conn.targetId;
      const outCount = Math.min(maxHandles, Math.max(1, connectionCountPerNode[sKey]?.outgoing ?? 1));
      const inCount = Math.min(maxHandles, Math.max(1, connectionCountPerNode[tKey]?.incoming ?? 1));
      const sIdx = (sourceUsage[sKey] ?? 0) % outCount;
      const tIdx = (targetUsage[tKey] ?? 0) % inCount;
      sourceUsage[sKey] = (sourceUsage[sKey] ?? 0) + 1;
      targetUsage[tKey] = (targetUsage[tKey] ?? 0) + 1;
      return {
        connId: conn.id,
        sourceHandle: `source-${sIdx}`,
        targetHandle: `target-${tIdx}`,
      };
    });
  }, [visibleConnections, connectionCountPerNode]);

  const nodes = useMemo(() => {
    if (!diagram) return [];

    const ctx: NodeBuildContext = {
      diagram,
      serviceRegistry: serviceRegistry ?? {},
      allDiagrams,
      selectedNodeId,
      dragTargetPanelId,
      panelIds,
      connectionCounts: connectionCountPerNode,
      isPlaying,
      isRecording: !!isRecording,
      flowHighlight,
      activeStep,
      recordingInfo,
      coverage,
      handleDrillDown,
      onRecordHandleClick,
    };

    return [...visibleComponents]
      .sort((a, b) => (a.type === "panel" ? -1 : b.type === "panel" ? 1 : 0))
      .map((comp): Node => {
        const d = getDescriptor(comp.type);
        const layout = diagram.nodeLayouts.find((nl) => nl.elementId === comp.id);
        const isChild =
          d.canHaveParent && comp.parentId !== null && panelIds.has(comp.parentId);
        const zIndex =
          layout?.zIndex ?? (typeof d.zIndex === "function" ? d.zIndex(comp) : d.zIndex);

        return {
          id: comp.id,
          type: d.rfType,
          position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
          zIndex,
          connectable: d.connectable,
          ...(isChild ? { parentId: comp.parentId!, extent: "parent" as const } : {}),
          style: d.buildStyle?.(comp, ctx),
          data: d.buildData(comp, ctx),
        };
      });
  }, [
    diagram,
    visibleComponents,
    panelIds,
    selectedNodeId,
    serviceRegistry,
    allDiagrams,
    handleDrillDown,
    isPlaying,
    flowHighlight,
    dragTargetPanelId,
    isRecording,
    recordingInfo,
    onRecordHandleClick,
    activeStep,
    coverage,
    connectionCountPerNode,
  ]);

  const edges: Edge[] = useMemo(() => {
    if (!diagram) return [];
    const assignmentMap = new Map(
      edgeHandleAssignments.map((a) => [a.connId, a]),
    );
    const edgeList: Edge[] = visibleConnections.map((conn) => {
      const assignment = assignmentMap.get(conn.id);
      const isActiveConn = isPlaying && flowHighlight.activeConnId === conn.id;
      const isParticipantConn =
        isPlaying && flowHighlight.participantConnIds.has(conn.id);
      const effective = getEffectiveConnectionStyle(conn);
      const markerEndType =
        effective.markerEnd === "none"
          ? undefined
          : effective.markerEnd === "arrow"
            ? MarkerType.Arrow
            : MarkerType.ArrowClosed;
      const markerStartType =
        effective.markerStart !== "none"
          ? effective.markerStart === "arrowclosed"
            ? MarkerType.ArrowClosed
            : MarkerType.Arrow
          : undefined;
      return {
        id: conn.id,
        source: conn.sourceId,
        target: conn.targetId,
        sourceHandle: assignment?.sourceHandle,
        targetHandle: assignment?.targetHandle,
        type: "c4",
        data: {
          label: conn.label,
          technology: conn.technology,
          connectionId: conn.id,
          recordingBadges: recordingInfo?.edgeSteps.get(conn.id),
          isLastRecorded: recordingInfo?.lastEdgeId === conn.id,
          coverageFlowNames: coverage?.edgeFlows.get(conn.id),
          playbackDuration: isPlaying && flowHighlight.activeConnId === conn.id ? activeStep?.duration : undefined,
          edgeStyle: conn.edgeStyle,
          strokeStyle: effective.strokeStyle,
          strokeWidth: effective.strokeWidth,
        },
        selected: selectedEdgeId === conn.id,
        animated: isActiveConn || (effective.animated && !isPlaying),
        markerEnd: markerEndType !== undefined ? { type: markerEndType } : undefined,
        markerStart: markerStartType !== undefined ? { type: markerStartType } : undefined,
        style: isPlaying
          ? { opacity: isActiveConn ? 1 : isParticipantConn ? 0.5 : 0.2 }
          : isRecording
            ? { opacity: recordingInfo?.recordedEdgeIds.has(conn.id) ? 1 : 0.2 }
            : undefined,
      };
    });

    return edgeList;
  }, [diagram, visibleConnections, edgeHandleAssignments, selectedEdgeId, isPlaying, flowHighlight, isRecording, recordingInfo, coverage, activeStep]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      changes.forEach((change) => {
        if (change.type === "position" && change.position)
          updateNodeLayout(change.id, change.position);
        if (change.type === "dimensions" && change.dimensions)
          updateComponent(change.id, {
            width: change.dimensions.width,
            height: change.dimensions.height,
          });

        if (
          change.type === "position" &&
          "dragging" in change &&
          change.dragging &&
          change.position
        ) {
          const dragId = change.id;
          const comp = diagram?.snapshot.components[dragId];
          if (!comp || comp.type === "panel" || comp.type === "note") return;

          let absX = change.position.x;
          let absY = change.position.y;

          if (comp.parentId) {
            const parentLayout = diagram?.nodeLayouts.find(
              (nl) => nl.elementId === comp.parentId,
            );
            if (parentLayout) {
              absX += parentLayout.x;
              absY += parentLayout.y;
            }
          }

          const panels = nodes.filter(
            (n) => n.type === "panel" && n.id !== comp.parentId,
          );
          const match = panels.find(
            (p) =>
              absX > p.position.x &&
              absY > p.position.y &&
              absX <
                p.position.x +
                  ((p.style?.width as number) ?? PANEL_DEFAULT_W) &&
              absY <
                p.position.y + ((p.style?.height as number) ?? PANEL_DEFAULT_H),
          );

          const newTarget = match?.id ?? null;
          if (newTarget !== dragTargetRef.current) {
            dragTargetRef.current = newTarget;
            setDragTargetPanelId(newTarget);
          }
        }
      });
    },
    [updateNodeLayout, updateComponent, diagram, nodes],
  );

  const onNodeDragStop = useCallback(
    (_: unknown, draggedNode: Node) => {
      if (draggedNode.type === "panel") return;
      if (draggedNode.parentId) {
        const parent = nodes.find((n) => n.id === draggedNode.parentId);
        if (parent) {
          const pw = (parent.style?.width as number) ?? PANEL_DEFAULT_W;
          const ph = (parent.style?.height as number) ?? PANEL_DEFAULT_H;
          if (
            draggedNode.position.x < -20 ||
            draggedNode.position.y < -20 ||
            draggedNode.position.x > pw + 20 ||
            draggedNode.position.y > ph + 20
          ) {
            setParent(draggedNode.id, null);
            updateNodeLayout(draggedNode.id, {
              x: parent.position.x + draggedNode.position.x,
              y: parent.position.y + draggedNode.position.y,
            });
            return;
          }
        }
        return;
      }

      const panels = nodes.filter((n) => n.type === "panel");
      const match = panels.find(
        (p) =>
          draggedNode.position.x > p.position.x &&
          draggedNode.position.y > p.position.y &&
          draggedNode.position.x <
            p.position.x + ((p.style?.width as number) ?? PANEL_DEFAULT_W) &&
          draggedNode.position.y <
            p.position.y + ((p.style?.height as number) ?? PANEL_DEFAULT_H),
      );

      if (match) {
        setParent(draggedNode.id, match.id);
        updateNodeLayout(draggedNode.id, {
          x: draggedNode.position.x - match.position.x,
          y: draggedNode.position.y - match.position.y,
        });
      }
    },
    [nodes, setParent, updateNodeLayout],
  );

  const onEdgesChange: OnEdgesChange = useCallback((_changes) => {
    // Edge changes are handled by ReactFlow
  }, []);

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

  const onNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (isRecording) {
        if (node.type !== "panel" && node.type !== "note") {
          onRecordNodeClick?.(node.id);
        }
        return;
      }
      if (isPlaying) return;
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
      setContextMenu(null);
    },
    [isPlaying, isRecording, onRecordNodeClick],
  );
  const onEdgeClick = useCallback(
    (_: React.MouseEvent, edge: Edge) => {
      if (isRecording) {
        onRecordEdgeClick?.(edge.id, edge.sourceHandle ?? undefined);
        return;
      }
      setSelectedEdgeId(edge.id);
      setSelectedNodeId(null);
      setContextMenu(null);
    },
    [isRecording, onRecordEdgeClick],
  );
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setContextMenu(null);
  }, []);
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      if (isRecording) return;
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        elementId: node.id,
      });
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
    },
    [isRecording],
  );
  const closePanel = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.tagName === "SELECT" ||
        target.isContentEditable
      )
        return;
      if (!diagram) return;

      if (isRecording) {
        if (e.key === "Backspace" || e.key === "Delete") {
          e.preventDefault();
          onRecordUndo?.();
        }
        return;
      }

      const mod = e.metaKey || e.ctrlKey;

      if (e.key === "Escape") {
        e.preventDefault();
        reactFlowInstance.setNodes((nds) =>
          nds.map((n) => ({ ...n, selected: false })),
        );
        setSelectedNodeId(null);
        setSelectedEdgeId(null);
        setContextMenu(null);
        return;
      }
      if (mod && e.key === "a") {
        e.preventDefault();
        reactFlowInstance.setNodes((nds) =>
          nds.map((n) => ({ ...n, selected: true })),
        );
        return;
      }
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        const selected = reactFlowInstance.getNodes().filter((n) => n.selected);
        if (selected.length === 0 && selectedNodeId) {
          removeComponent(selectedNodeId);
          setSelectedNodeId(null);
          return;
        }
        if (selected.length > 0) {
          for (const n of selected) removeComponent(n.id);
          setSelectedNodeId(null);
        }
        return;
      }
      if (mod && e.key === "d") {
        e.preventDefault();
        const selected = reactFlowInstance.getNodes().filter((n) => n.selected);
        const toDuplicate =
          selected.length > 0
            ? selected
            : selectedNodeId
              ? reactFlowInstance
                  .getNodes()
                  .filter((n) => n.id === selectedNodeId)
              : [];
        if (toDuplicate.length === 0) return;
        for (const n of toDuplicate) {
          const comp = diagram.snapshot.components[n.id];
          if (!comp) continue;
          const layout = diagram.nodeLayouts.find(
            (nl) => nl.elementId === n.id,
          );
          addComponent(
            comp.type,
            `${comp.name} (cópia)`,
            comp.parentId,
            { x: (layout?.x ?? 0) + 30, y: (layout?.y ?? 0) + 30 },
            comp.awsService,
          );
        }
        return;
      }
      if (mod && e.shiftKey && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        redo();
        return;
      }
      if (mod && e.key === "z") {
        e.preventDefault();
        undo();
        return;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [
    diagram,
    selectedNodeId,
    reactFlowInstance,
    undo,
    redo,
    removeComponent,
    addComponent,
    isRecording,
    onRecordUndo,
  ]);

  if (!diagram)
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground">
        Nenhum diagrama selecionado
      </div>
    );

  return (
    <div className="flex-1 flex relative">
      <div className="flex-1 relative">
        <CanvasToolbar
          onDrillUp={onDrillUp}
          isPanelOpen={!!(selectedNodeId || selectedEdgeId) && !isRecording}
        />
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onNodeClick={onNodeClick}
          onEdgeClick={onEdgeClick}
          onPaneClick={onPaneClick}
          onNodeContextMenu={onNodeContextMenu}
          onNodeDragStop={onNodeDragStop}
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
      {(selectedNodeId || selectedEdgeId) && !isRecording && (
        <ElementPanel
          key={selectedNodeId ?? selectedEdgeId}
          selectedElementId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
          onClose={closePanel}
        />
      )}
    </div>
  );
};

export default Canvas;
