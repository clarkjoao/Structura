import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  useReactFlow,
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
} from "@/lib/model-store";
import { generateId } from "@/lib/model-types";
import CustomNode from "./CustomNode";
import CustomEdge from "./CustomEdge";
import PanelNode from "./PanelNode";
import NoteNode from "./NoteNode";
import CanvasToolbar from "./CanvasToolbar";
import ElementPanel from "./ElementPanel";
import NodeContextMenu from "./NodeContextMenu";

const nodeTypes = {
  c4: CustomNode,
  panel: PanelNode,
  note: NoteNode,
};

const edgeTypes = { c4: CustomEdge };

const PANEL_DEFAULT_W = 600;
const PANEL_DEFAULT_H = 400;

interface CanvasProps {
  activeFlow?: import("@/lib/model-types").Flow | null;
  currentStep?: number;
  onOpenDiagram?: (id: string) => void;
  onDrillUp?: () => void;
}

const Canvas = ({
  activeFlow,
  currentStep,
  onOpenDiagram,
  onDrillUp,
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

  const nodes = useMemo(() => {
    if (!diagram) return [];

    const sorted = [...visibleComponents].sort((a, b) =>
      a.type === "panel" ? -1 : b.type === "panel" ? 1 : 0,
    );

    const nodeList: Node[] = [];

    for (const comp of sorted) {
      const layout = diagram.nodeLayouts.find((nl) => nl.elementId === comp.id);

      if (comp.type === "panel") {
        nodeList.push({
          id: comp.id,
          type: "panel",
          position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
          zIndex: layout?.zIndex ?? -1,
          style: {
            width: comp.width ?? PANEL_DEFAULT_W,
            height: comp.height ?? PANEL_DEFAULT_H,
          },
          data: {
            elementId: comp.id,
            name: comp.name,
            description: comp.description || undefined,
            panelColor: comp.panelColor,
            panelOpacity: comp.panelOpacity,
            isSelected: selectedNodeId === comp.id,
            isDragTarget: dragTargetPanelId === comp.id,
          },
        });
      } else if (comp.type === "note") {
        const isChildOfPanel =
          comp.parentId !== null && panelIds.has(comp.parentId);
        nodeList.push({
          id: comp.id,
          type: "note",
          position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
          zIndex: layout?.zIndex ?? 1,
          connectable: false,
          ...(isChildOfPanel
            ? { parentId: comp.parentId!, extent: "parent" as const }
            : {}),
          ...(comp.width || comp.height
            ? { style: { width: comp.width, height: comp.height } }
            : {}),
          data: {
            elementId: comp.id,
            name: comp.name,
            description: comp.description,
            panelColor: comp.panelColor,
            isSelected: selectedNodeId === comp.id,
          },
        });
      } else {
        const isChildOfPanel =
          comp.parentId !== null && panelIds.has(comp.parentId);
        const linkedDiagramName = comp.linkedDiagramId
          ? allDiagrams[comp.linkedDiagramId]?.name
          : undefined;

        const flowNodeStyle = isPlaying
          ? (() => {
              const isActive = flowHighlight.activeNodeId === comp.id;
              const isVisited = flowHighlight.visitedNodeIds.has(comp.id);
              const isParticipant = flowHighlight.participantNodeIds.has(
                comp.id,
              );
              if (isActive) return { opacity: 1, filter: "none" };
              if (isVisited) return { opacity: 0.85, filter: "none" };
              if (isParticipant) return { opacity: 0.5, filter: "none" };
              return { opacity: 0.25, filter: "none" };
            })()
          : undefined;

        nodeList.push({
          id: comp.id,
          type: "c4",
          position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
          zIndex: layout?.zIndex ?? 1,
          ...(isChildOfPanel
            ? { parentId: comp.parentId!, extent: "parent" as const }
            : {}),
          ...(flowNodeStyle ? { style: flowNodeStyle } : {}),
          data: {
            elementId: comp.id,
            name: comp.name,
            type: comp.type,
            description: comp.description,
            technology: comp.technology,
            awsService: comp.awsService,
            isSelected: isPlaying
              ? flowHighlight.activeNodeId === comp.id
              : selectedNodeId === comp.id,
            serviceName: comp.serviceId
              ? serviceRegistry[comp.serviceId]?.name
              : undefined,
            linkedDiagramName: isPlaying ? undefined : linkedDiagramName,
            onDrillDown: isPlaying
              ? undefined
              : linkedDiagramName
                ? handleDrillDown
                : undefined,
          } as Record<string, unknown>,
        });
      }
    }

    return nodeList;
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
  ]);

  const edges: Edge[] = useMemo(() => {
    if (!diagram) return [];
    const edgeList: Edge[] = visibleConnections.map((conn) => {
      const isActiveConn = isPlaying && flowHighlight.activeConnId === conn.id;
      const isParticipantConn =
        isPlaying && flowHighlight.participantConnIds.has(conn.id);
      return {
        id: conn.id,
        source: conn.sourceId,
        target: conn.targetId,
        type: "c4",
        data: {
          label: conn.label,
          technology: conn.technology,
          connectionId: conn.id,
        },
        selected: selectedEdgeId === conn.id,
        animated: isActiveConn,
        style: isPlaying
          ? { opacity: isActiveConn ? 1 : isParticipantConn ? 0.5 : 0.2 }
          : undefined,
      };
    });

    return edgeList;
  }, [diagram, visibleConnections, selectedEdgeId, isPlaying, flowHighlight]);

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

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
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
      if (isPlaying) return;
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
      setContextMenu(null);
    },
    [isPlaying],
  );
  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
    setContextMenu(null);
  }, []);
  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
    setContextMenu(null);
  }, []);
  const onNodeContextMenu = useCallback(
    (event: React.MouseEvent, node: Node) => {
      event.preventDefault();
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        elementId: node.id,
      });
      setSelectedNodeId(node.id);
      setSelectedEdgeId(null);
    },
    [],
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
            { x: (layout?.x ?? 0) + 20, y: (layout?.y ?? 0) + 20 },
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
        <CanvasToolbar onDrillUp={onDrillUp} />
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
      {(selectedNodeId || selectedEdgeId) && (
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
