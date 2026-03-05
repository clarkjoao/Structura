import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow, Background, BackgroundVariant, Controls,
  type Node, type Edge, type OnNodesChange, type OnEdgesChange, type OnConnect, type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useNavigate } from "react-router-dom";
import { useActiveDiagram, useDiagrams, useVisibleComponents, useVisibleConnections, useServiceRegistry, useDiagramActions } from "@/lib/model-store";
import CustomNode from "./CustomNode";
import CustomEdge from "./CustomEdge";
import PanelNode from "./PanelNode";
import CanvasToolbar from "./CanvasToolbar";
import ElementPanel from "./ElementPanel";
import NodeContextMenu from "./NodeContextMenu";

const nodeTypes = { c4: CustomNode, panel: PanelNode };
const edgeTypes = { c4: CustomEdge };

const PANEL_DEFAULT_W = 600;
const PANEL_DEFAULT_H = 400;

const Canvas = () => {
  const diagram = useActiveDiagram();
  const allDiagrams = useDiagrams();
  const visibleComponents = useVisibleComponents();
  const visibleConnections = useVisibleConnections();
  const serviceRegistry = useServiceRegistry();
  const {
    updateNodeLayout, updateViewport, addConnection,
    bringToFront, sendToBack, openDiagram,
    updateComponent, setParent,
  } = useDiagramActions();
  const navigate = useNavigate();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; elementId: string } | null>(null);

  const handleDrillDown = useCallback((elementId: string) => {
    if (!diagram) return;
    const comp = diagram.snapshot.components[elementId];
    if (comp?.linkedDiagramId && allDiagrams[comp.linkedDiagramId]) {
      openDiagram(comp.linkedDiagramId);
      navigate(`/model/${comp.linkedDiagramId}`);
    }
  }, [diagram, allDiagrams, openDiagram, navigate]);

  const panelIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of visibleComponents) {
      if (c.type === "panel") ids.add(c.id);
    }
    return ids;
  }, [visibleComponents]);

  const nodes = useMemo(() => {
    if (!diagram) return [];

    const sorted = [...visibleComponents].sort((a, b) =>
      a.type === "panel" ? -1 : b.type === "panel" ? 1 : 0
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
          style: { width: comp.width ?? PANEL_DEFAULT_W, height: comp.height ?? PANEL_DEFAULT_H },
          data: { elementId: comp.id, name: comp.name, isSelected: selectedNodeId === comp.id },
        });
      } else {
        const isChildOfPanel = comp.parentId !== null && panelIds.has(comp.parentId);
        const linkedDiagramName = comp.linkedDiagramId ? allDiagrams[comp.linkedDiagramId]?.name : undefined;

        nodeList.push({
          id: comp.id,
          type: "c4",
          position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
          zIndex: layout?.zIndex ?? 1,
          ...(isChildOfPanel ? { parentId: comp.parentId!, extent: "parent" as const } : {}),
          data: {
            elementId: comp.id, name: comp.name, type: comp.type,
            description: comp.description, technology: comp.technology,
            awsService: comp.awsService, isSelected: selectedNodeId === comp.id,
            serviceName: comp.serviceId ? serviceRegistry[comp.serviceId]?.name : undefined,
            linkedDiagramName,
            onDrillDown: linkedDiagramName ? handleDrillDown : undefined,
          } as Record<string, unknown>,
        });
      }
    }

    return nodeList;
  }, [diagram, visibleComponents, panelIds, selectedNodeId, serviceRegistry, allDiagrams, handleDrillDown]);

  const edges: Edge[] = useMemo(() => {
    return visibleConnections.map((conn) => ({
      id: conn.id, source: conn.sourceId, target: conn.targetId, type: "c4",
      data: { label: conn.label, technology: conn.technology, connectionId: conn.id },
      selected: selectedEdgeId === conn.id,
    }));
  }, [visibleConnections, selectedEdgeId]);

  const onNodesChange: OnNodesChange = useCallback((changes) => {
    changes.forEach((change) => {
      if (change.type === "position" && change.position) updateNodeLayout(change.id, change.position);
      if (change.type === "dimensions" && change.dimensions) updateComponent(change.id, { width: change.dimensions.width, height: change.dimensions.height });
    });
  }, [updateNodeLayout, updateComponent]);

  const onNodeDragStop = useCallback((_: unknown, draggedNode: Node) => {
    if (draggedNode.type === "panel") return;

    if (draggedNode.parentId) {
      const parent = nodes.find((n) => n.id === draggedNode.parentId);
      if (parent) {
        const pw = (parent.style?.width as number) ?? PANEL_DEFAULT_W;
        const ph = (parent.style?.height as number) ?? PANEL_DEFAULT_H;
        const nx = draggedNode.position.x;
        const ny = draggedNode.position.y;
        if (nx < -20 || ny < -20 || nx > pw + 20 || ny > ph + 20) {
          const absX = parent.position.x + nx;
          const absY = parent.position.y + ny;
          setParent(draggedNode.id, null);
          updateNodeLayout(draggedNode.id, { x: absX, y: absY });
          return;
        }
      }
      return;
    }

    const panels = nodes.filter((n) => n.type === "panel");
    const match = panels.find((p) =>
      draggedNode.position.x > p.position.x &&
      draggedNode.position.y > p.position.y &&
      draggedNode.position.x < p.position.x + ((p.style?.width as number) ?? PANEL_DEFAULT_W) &&
      draggedNode.position.y < p.position.y + ((p.style?.height as number) ?? PANEL_DEFAULT_H)
    );

    if (match) {
      setParent(draggedNode.id, match.id);
      updateNodeLayout(draggedNode.id, {
        x: draggedNode.position.x - match.position.x,
        y: draggedNode.position.y - match.position.y,
      });
    }
  }, [nodes, setParent, updateNodeLayout]);

  const onEdgesChange: OnEdgesChange = useCallback(() => {}, []);
  const onMoveEnd = useCallback((_: unknown, vp: { x: number; y: number; zoom: number }) => { updateViewport(vp); }, [updateViewport]);
  const onConnect: OnConnect = useCallback((c: Connection) => { if (c.source && c.target) addConnection(c.source, c.target, "Usa"); }, [addConnection]);

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => { setSelectedNodeId(node.id); setSelectedEdgeId(null); setContextMenu(null); }, []);
  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => { setSelectedEdgeId(edge.id); setSelectedNodeId(null); setContextMenu(null); }, []);
  const onPaneClick = useCallback(() => { setSelectedNodeId(null); setSelectedEdgeId(null); setContextMenu(null); }, []);
  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => { event.preventDefault(); setContextMenu({ x: event.clientX, y: event.clientY, elementId: node.id }); setSelectedNodeId(node.id); setSelectedEdgeId(null); }, []);
  const closePanel = useCallback(() => { setSelectedNodeId(null); setSelectedEdgeId(null); }, []);

  if (!diagram) return <div className="flex-1 flex items-center justify-center text-muted-foreground">Nenhum diagrama selecionado</div>;

  return (
    <div className="flex-1 flex relative">
      <div className="flex-1 relative">
        <CanvasToolbar />
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes}
          onNodesChange={onNodesChange} onEdgesChange={onEdgesChange} onConnect={onConnect}
          onNodeClick={onNodeClick} onEdgeClick={onEdgeClick} onPaneClick={onPaneClick}
          onNodeContextMenu={onNodeContextMenu} onNodeDragStop={onNodeDragStop}
          defaultViewport={diagram.viewport} fitView fitViewOptions={{ padding: 0.3 }}
          onMoveEnd={onMoveEnd} proOptions={{ hideAttribution: true }} className="bg-background">
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(220 20% 18%)" />
          <Controls className="!bg-card !border-border !rounded-lg !shadow-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-muted-foreground [&>button:hover]:!bg-surface-hover [&>button]:!rounded-md [&>button]:!w-8 [&>button]:!h-8" />
        </ReactFlow>
      </div>
      {contextMenu && <NodeContextMenu x={contextMenu.x} y={contextMenu.y} elementId={contextMenu.elementId} onBringToFront={bringToFront} onSendToBack={sendToBack} onClose={() => setContextMenu(null)} />}
      {(selectedNodeId || selectedEdgeId) && <ElementPanel selectedElementId={selectedNodeId} selectedEdgeId={selectedEdgeId} onClose={closePanel} />}
    </div>
  );
};

export default Canvas;
