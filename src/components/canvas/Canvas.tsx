import { useCallback, useMemo, useRef, useState } from "react";
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
  useActiveBluePrintView,
  useVisibleComponents,
  useVisibleConnections,
  useCanNavigateInto,
  useDiagramActions,
} from "@/lib/model-store";
import CustomNode from "./CustomNode";
import CustomEdge from "./CustomEdge";
import GroupNode from "./GroupNode";
import CanvasToolbar from "./CanvasToolbar";
import ElementPanel from "./ElementPanel";

const nodeTypes = { c4: CustomNode, group: GroupNode };
const edgeTypes = { c4: CustomEdge };

// Per-node hook wrapper to avoid calling hooks conditionally
const useNodeCanNavigate = (id: string) => useCanNavigateInto(id);

const Canvas = () => {
  const activeView = useActiveBluePrintView();
  const visibleComponents = useVisibleComponents();
  const visibleConnections = useVisibleConnections();
  const {
    updateNodeLayout,
    updateNodeSize,
    updateViewport,
    navigateInto,
    addConnection,
    updateComponent,
  } = useDiagramActions();

  const reactFlowInstance = useReactFlow();

  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

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

  // Determine which components are groups (have children in the current view)
  const groupIds = useMemo(() => {
    const visibleIds = new Set(visibleComponents.map((c) => c.id));
    const groups = new Set<string>();
    for (const c of visibleComponents) {
      if (c.parentId && visibleIds.has(c.parentId)) {
        groups.add(c.parentId);
      }
    }
    return groups;
  }, [visibleComponents]);

  // Derive React Flow nodes from visible components
  // Groups must come before their children in the array for React Flow parent-child to work
  const nodes = useMemo(() => {
    const nodeList: Node[] = [];
    const visibleIds = new Set(visibleComponents.map((c) => c.id));

    // First pass: groups
    for (const component of visibleComponents) {
      if (!groupIds.has(component.id)) continue;
      const layout = activeView.nodeLayouts.find(
        (nl) => nl.elementId === component.id,
      );
      nodeList.push({
        id: component.id,
        type: "group",
        position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
        style: {
          width: layout?.width ?? 500,
          height: layout?.height ?? 350,
        },
        data: {
          elementId: component.id,
          name: component.name,
          type: component.type,
          description: component.description,
          technology: component.technology,
          isSelected: selectedNodeId === component.id,
        },
      });
    }

    // Second pass: regular nodes
    for (const component of visibleComponents) {
      if (groupIds.has(component.id)) continue;
      const layout = activeView.nodeLayouts.find(
        (nl) => nl.elementId === component.id,
      );
      const isChildOfGroup =
        component.parentId && visibleIds.has(component.parentId) && groupIds.has(component.parentId);

      nodeList.push({
        id: component.id,
        type: "c4",
        position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
        ...(isChildOfGroup
          ? { parentId: component.parentId!, extent: "parent" as const }
          : {}),
        data: {
          elementId: component.id,
          name: component.name,
          type: component.type,
          description: component.description,
          technology: component.technology,
          awsService: component.awsService,
          isSelected: selectedNodeId === component.id,
          onDrillDown: handleDrillDown,
          onSelect: handleSelectNode,
        } as Record<string, unknown>,
      });
    }

    return nodeList;
  }, [
    activeView,
    visibleComponents,
    groupIds,
    selectedNodeId,
    handleDrillDown,
    handleSelectNode,
  ]);

  // Derive React Flow edges from visible connections
  const edges: Edge[] = useMemo(() => {
    return visibleConnections.map((conn) => ({
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
  }, [visibleConnections, selectedEdgeId]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      changes.forEach((change) => {
        if (change.type === "position" && change.position) {
          updateNodeLayout(change.id, change.position);
        }
        if (change.type === "dimensions" && change.dimensions) {
          updateNodeSize(change.id, change.dimensions.width, change.dimensions.height);
        }
      });
    },
    [updateNodeLayout, updateNodeSize],
  );

  const onEdgesChange: OnEdgesChange = useCallback(() => {
    // Edge selection handled via click — no state update needed
  }, []);

  // Persist viewport changes to the store without triggering re-renders.
  // We use a ref to debounce and avoid calling updateViewport on every pixel
  // of movement, which would cause a store update → re-render loop.
  const onMoveEnd = useCallback(
    (_: unknown, viewport: { x: number; y: number; zoom: number }) => {
      updateViewport(viewport);
    },
    [updateViewport],
  );

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        addConnection(connection.source, connection.target, "Usa");
      }
    },
    [addConnection],
  );

  // Detect drag-into-group: when a non-group node is dropped inside a group boundary
  const onNodeDragStop = useCallback(
    (_: React.MouseEvent, draggedNode: Node) => {
      if (groupIds.has(draggedNode.id)) return; // don't nest groups
      if (draggedNode.parentId) return; // already a child

      const allNodes = reactFlowInstance.getNodes();
      for (const potentialGroup of allNodes) {
        if (potentialGroup.type !== "group") continue;
        if (potentialGroup.id === draggedNode.id) continue;

        const gx = potentialGroup.position.x;
        const gy = potentialGroup.position.y;
        const gw = (potentialGroup.style?.width as number) ?? 500;
        const gh = (potentialGroup.style?.height as number) ?? 350;

        const nx = draggedNode.position.x;
        const ny = draggedNode.position.y;

        if (nx > gx && nx < gx + gw && ny > gy && ny < gy + gh) {
          // Set parentId in model
          updateComponent(draggedNode.id, {
            parentId: potentialGroup.id,
          });
          // Update layout to relative position
          updateNodeLayout(draggedNode.id, {
            x: nx - gx,
            y: ny - gy,
          });
          break;
        }
      }
    },
    [groupIds, reactFlowInstance, updateComponent, updateNodeLayout],
  );

  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
    setSelectedEdgeId(null);
  }, []);

  const onEdgeClick = useCallback((_: React.MouseEvent, edge: Edge) => {
    setSelectedEdgeId(edge.id);
    setSelectedNodeId(null);
  }, []);

  const onPaneClick = useCallback(() => {
    setSelectedNodeId(null);
    setSelectedEdgeId(null);
  }, []);

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
          onNodeDragStop={onNodeDragStop}
          defaultViewport={activeView.viewport}
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
