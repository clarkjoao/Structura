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
  useCanNavigateInto,
  useDiagramActions,
} from "@/lib/model-store";
import CustomNode from "./CustomNode";
import CustomEdge from "./CustomEdge";
import CanvasToolbar from "./CanvasToolbar";
import ElementPanel from "./ElementPanel";

const nodeTypes = { c4: CustomNode };
const edgeTypes = { c4: CustomEdge };

// Per-node hook wrapper to avoid calling hooks conditionally
const useNodeCanNavigate = (id: string) => useCanNavigateInto(id);

const Canvas = () => {
  const activeView = useActiveBluePrintView();
  const visibleComponents = useVisibleComponents();
  const visibleConnections = useVisibleConnections();
  const { updateNodeLayout, updateViewport, navigateInto, addConnection } =
    useDiagramActions();

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

  // Derive React Flow nodes from visible components
  const nodes = useMemo(() => {
    return visibleComponents.map((component) => {
      const layout = activeView.nodeLayouts.find(
        (nl) => nl.elementId === component.id,
      );
      const data = {
        elementId: component.id,
        name: component.name,
        type: component.type,
        description: component.description,
        technology: component.technology,
        awsService: component.awsService,
        // canNavigateInto is derived per-node in the C4Node component via useCanNavigateInto
        isSelected: selectedNodeId === component.id,
        onDrillDown: handleDrillDown,
        onSelect: handleSelectNode,
      } as Record<string, unknown>;

      return {
        id: component.id,
        type: "c4",
        position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
        data,
      };
    });
  }, [
    activeView,
    visibleComponents,
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
      });
    },
    [updateNodeLayout],
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
