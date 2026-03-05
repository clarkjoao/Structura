import { useCallback, useMemo, useState } from "react";
import {
  ReactFlow,
  Background,
  BackgroundVariant,
  Controls,
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  useActiveBluePrintView,
  useVisibleComponents,
  useVisibleConnections,
  useServiceRegistry,
  useDiagramActions,
} from "@/lib/model-store";
import CustomNode from "./CustomNode";
import CustomEdge from "./CustomEdge";
import CanvasToolbar from "./CanvasToolbar";
import ElementPanel from "./ElementPanel";
import NodeContextMenu from "./NodeContextMenu";

const nodeTypes = { c4: CustomNode };
const edgeTypes = { c4: CustomEdge };

const Canvas = () => {
  const activeView = useActiveBluePrintView();
  const visibleComponents = useVisibleComponents();
  const visibleConnections = useVisibleConnections();
  const serviceRegistry = useServiceRegistry();
  const {
    updateNodeLayout,
    updateViewport,
    navigateInto,
    addConnection,
    bringToFront,
    sendToBack,
  } = useDiagramActions();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    elementId: string;
  } | null>(null);

  const handleDrillDown = useCallback(
    (elementId: string) => {
      navigateInto(elementId);
      setSelectedNodeId(null);
    },
    [navigateInto],
  );

  const handleSelectNode = useCallback((elementId: string) => {
    setSelectedNodeId(elementId);
    setSelectedEdgeId(null);
  }, []);

  const nodes = useMemo(() => {
    return visibleComponents.map((comp) => {
      const layout = activeView.nodeLayouts.find((nl) => nl.elementId === comp.id);
      return {
        id: comp.id,
        type: "c4",
        position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
        zIndex: layout?.zIndex ?? 0,
        data: {
          elementId: comp.id,
          name: comp.name,
          type: comp.type,
          description: comp.description,
          technology: comp.technology,
          awsService: comp.awsService,
          isSelected: selectedNodeId === comp.id,
          onDrillDown: handleDrillDown,
          onSelect: handleSelectNode,
          serviceName: comp.serviceId ? serviceRegistry[comp.serviceId]?.name : undefined,
        } as Record<string, unknown>,
      } satisfies Node;
    });
  }, [activeView, visibleComponents, selectedNodeId, handleDrillDown, handleSelectNode, serviceRegistry]);

  const edges: Edge[] = useMemo(() => {
    return visibleConnections.map((conn) => ({
      id: conn.id,
      source: conn.sourceId,
      target: conn.targetId,
      type: "c4",
      data: { label: conn.label, technology: conn.technology, connectionId: conn.id },
      selected: selectedEdgeId === conn.id,
    }));
  }, [visibleConnections, selectedEdgeId]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      changes.forEach((change) => {
        if (change.type === "position" && change.position) {
          updateNodeLayout(change.id, change.position);
        }
      });
    },
    [updateNodeLayout],
  );

  const onEdgesChange: OnEdgesChange = useCallback(() => {}, []);

  const onMoveEnd = useCallback(
    (_: unknown, viewport: { x: number; y: number; zoom: number }) => { updateViewport(viewport); },
    [updateViewport],
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) addConnection(connection.source, connection.target, "Usa");
    },
    [addConnection],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id); setSelectedEdgeId(null); setContextMenu(null);
  }, []);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id); setSelectedNodeId(null); setContextMenu(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null); setSelectedEdgeId(null); setContextMenu(null);
  }, []);

  const onNodeContextMenu = useCallback((event: React.MouseEvent, node: Node) => {
    event.preventDefault();
    setContextMenu({ x: event.clientX, y: event.clientY, elementId: node.id });
    setSelectedNodeId(node.id); setSelectedEdgeId(null);
  }, []);

  const closePanel = useCallback(() => { setSelectedNodeId(null); setSelectedEdgeId(null); }, []);

  return (
    <div className="flex-1 flex relative">
      <div className="flex-1 relative">
        <CanvasToolbar />
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
          defaultViewport={activeView.viewport}
          fitView
          fitViewOptions={{ padding: 0.3 }}
          onMoveEnd={onMoveEnd}
          proOptions={{ hideAttribution: true }}
          className="bg-background"
        >
          <Background variant={BackgroundVariant.Dots} gap={20} size={1} color="hsl(220 20% 18%)" />
          <Controls className="!bg-card !border-border !rounded-lg !shadow-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-muted-foreground [&>button:hover]:!bg-surface-hover [&>button]:!rounded-md [&>button]:!w-8 [&>button]:!h-8" />
        </ReactFlow>
      </div>

      {contextMenu && (
        <NodeContextMenu x={contextMenu.x} y={contextMenu.y} elementId={contextMenu.elementId}
          onBringToFront={bringToFront} onSendToBack={sendToBack} onClose={() => setContextMenu(null)} />
      )}

      {(selectedNodeId || selectedEdgeId) && (
        <ElementPanel selectedElementId={selectedNodeId} selectedEdgeId={selectedEdgeId} onClose={closePanel} />
      )}
    </div>
  );
};

export default Canvas;
