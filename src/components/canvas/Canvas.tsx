import { useCallback, useMemo, useState } from "react";
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
import {
  useAllComponents,
  useAllConnections,
  useServiceRegistry,
  useDiagramActions,
} from "@/lib/model-store";
import CustomNode from "./CustomNode";
import CustomEdge from "./CustomEdge";
import GroupNode from "./GroupNode";
import CanvasToolbar from "./CanvasToolbar";
import ElementPanel from "./ElementPanel";
import NodeContextMenu from "./NodeContextMenu";

const nodeTypes = { c4: CustomNode, group: GroupNode };
const edgeTypes = { c4: CustomEdge };

const GROUP_DEFAULT_W = 800;
const GROUP_DEFAULT_H = 500;

const Canvas = () => {
  const allComponents = useAllComponents();
  const allConnections = useAllConnections();
  const serviceRegistry = useServiceRegistry();
  const {
    updateNodePosition,
    updateNodeSize,
    addConnection,
    setComponentParent,
    bringToFront,
    sendToBack,
  } = useDiagramActions();

  const reactFlowInstance = useReactFlow();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    elementId: string;
  } | null>(null);

  const groupIds = useMemo(() => {
    const ids = new Set<string>();
    for (const c of allComponents) {
      if (c.type === "system") {
        ids.add(c.id);
      }
    }
    return ids;
  }, [allComponents]);

  const nodes = useMemo(() => {
    const nodeList: Node[] = [];

    for (const comp of allComponents) {
      if (groupIds.has(comp.id)) {
        nodeList.push({
          id: comp.id,
          type: "group",
          position: { x: comp.x, y: comp.y },
          zIndex: comp.zIndex ?? 0,
          style: {
            width: comp.width ?? GROUP_DEFAULT_W,
            height: comp.height ?? GROUP_DEFAULT_H,
          },
          data: {
            elementId: comp.id,
            name: comp.name,
            type: comp.type,
            description: comp.description,
            technology: comp.technology,
            isSelected: selectedNodeId === comp.id,
          },
        });
      }
    }

    for (const comp of allComponents) {
      if (groupIds.has(comp.id)) continue;

      const isChildOfGroup =
        comp.parentId !== null && groupIds.has(comp.parentId);

      nodeList.push({
        id: comp.id,
        type: "c4",
        position: { x: comp.x, y: comp.y },
        zIndex: comp.zIndex ?? 1,
        ...(isChildOfGroup
          ? { parentId: comp.parentId!, extent: "parent" as const }
          : {}),
        data: {
          elementId: comp.id,
          name: comp.name,
          type: comp.type,
          description: comp.description,
          technology: comp.technology,
          awsService: comp.awsService,
          isSelected: selectedNodeId === comp.id,
          serviceName: comp.serviceId
            ? serviceRegistry[comp.serviceId]?.name
            : undefined,
        } as Record<string, unknown>,
      });
    }

    return nodeList;
  }, [allComponents, groupIds, selectedNodeId, serviceRegistry]);

  const edges: Edge[] = useMemo(() => {
    return allConnections.map((conn) => ({
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
    }));
  }, [allConnections, selectedEdgeId]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      changes.forEach((change) => {
        if (change.type === "position" && change.position) {
          updateNodePosition(change.id, change.position);
        }
        if (change.type === "dimensions" && change.dimensions) {
          updateNodeSize(
            change.id,
            change.dimensions.width,
            change.dimensions.height,
          );
        }
      });
    },
    [updateNodePosition, updateNodeSize],
  );

  const onEdgesChange: OnEdgesChange = useCallback(() => {}, []);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        addConnection(connection.source, connection.target, "Usa");
      }
    },
    [addConnection],
  );

  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, draggedNode: Node) => {
      if (groupIds.has(draggedNode.id)) return;

      const allNodes = reactFlowInstance.getNodes();

      if (draggedNode.parentId) {
        const parent = allNodes.find((n) => n.id === draggedNode.parentId);
        if (parent) {
          const gw = (parent.style?.width as number) ?? GROUP_DEFAULT_W;
          const gh = (parent.style?.height as number) ?? GROUP_DEFAULT_H;
          const nx = draggedNode.position.x;
          const ny = draggedNode.position.y;

          if (nx < -20 || ny < -20 || nx > gw + 20 || ny > gh + 20) {
            const absX = parent.position.x + nx;
            const absY = parent.position.y + ny;
            setComponentParent(draggedNode.id, null);
            updateNodePosition(draggedNode.id, { x: absX, y: absY });
            return;
          }
        }
        return;
      }

      for (const potentialGroup of allNodes) {
        if (potentialGroup.type !== "group") continue;
        if (potentialGroup.id === draggedNode.id) continue;

        const gx = potentialGroup.position.x;
        const gy = potentialGroup.position.y;
        const gw = (potentialGroup.style?.width as number) ?? GROUP_DEFAULT_W;
        const gh = (potentialGroup.style?.height as number) ?? GROUP_DEFAULT_H;

        const nx = draggedNode.position.x;
        const ny = draggedNode.position.y;

        if (nx > gx && nx < gx + gw && ny > gy && ny < gy + gh) {
          setComponentParent(draggedNode.id, potentialGroup.id);
          updateNodePosition(draggedNode.id, { x: nx - gx, y: ny - gy });
          break;
        }
      }
    },
    [groupIds, reactFlowInstance, setComponentParent, updateNodePosition],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
    setContextMenu(null);
  }, []);

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
          onNodeDragStop={onNodeDragStop}
          fitView
          fitViewOptions={{ padding: 0.2 }}
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
          selectedElementId={selectedNodeId}
          selectedEdgeId={selectedEdgeId}
          onClose={closePanel}
        />
      )}
    </div>
  );
};

export default Canvas;
