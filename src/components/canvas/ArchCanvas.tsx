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
  applyNodeChanges,
  applyEdgeChanges,
  type Connection,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useModel } from "@/lib/model-store";
import C4Node, { type C4NodeData } from "./C4Node";
import C4Edge from "./C4Edge";
import CanvasToolbar from "./CanvasToolbar";
import ElementPanel from "./ElementPanel";

const nodeTypes = { c4: C4Node };
const edgeTypes = { c4: C4Edge };

const ArchCanvas = () => {
  const {
    draft,
    activeView,
    getVisibleElements,
    getVisibleRelationships,
    updateNodeLayout,
    updateViewport,
    navigateInto,
    canNavigateInto,
    addRelationship,
  } = useModel();

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

  // Derive React Flow nodes from the model
  const nodes = useMemo(() => {
    const elements = getVisibleElements();
    return elements.map((el) => {
      const layout = activeView.nodeLayouts.find(
        (nl) => nl.elementId === el.id,
      );
      const data = {
        elementId: el.id,
        name: el.name,
        type: el.type,
        description: el.description,
        technology: el.technology,
        awsService: el.awsService,
        canDrillDown: canNavigateInto(el.id),
        isSelected: selectedNodeId === el.id,
        onDrillDown: handleDrillDown,
        onSelect: handleSelectNode,
      } as Record<string, unknown>;
      return {
        id: el.id,
        type: "c4",
        position: { x: layout?.x ?? 0, y: layout?.y ?? 0 },
        data,
      };
    });
  }, [
    activeView,
    selectedNodeId,
    getVisibleElements,
    canNavigateInto,
    handleDrillDown,
    handleSelectNode,
  ]);

  // Derive React Flow edges from model relationships
  const edges: Edge[] = useMemo(() => {
    const rels = getVisibleRelationships();
    return rels.map((r) => ({
      id: r.id,
      source: r.sourceId,
      target: r.targetId,
      type: "c4",
      data: { label: r.label, technology: r.technology, relationshipId: r.id },
      selected: selectedEdgeId === r.id,
    }));
  }, [selectedEdgeId, getVisibleRelationships]);

  const onNodesChange: OnNodesChange = useCallback(
    (changes) => {
      // Update layout positions in the model for drag changes
      changes.forEach((change) => {
        if (change.type === "position" && change.position) {
          updateNodeLayout(change.id, change.position);
        }
      });
    },
    [updateNodeLayout],
  );

  const onEdgesChange: OnEdgesChange = useCallback((changes) => {
    // Edge selection handled via click
  }, []);

  const onConnect: OnConnect = useCallback(
    (connection: Connection) => {
      if (connection.source && connection.target) {
        addRelationship(connection.source, connection.target, "Usa");
      }
    },
    [addRelationship],
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

export default ArchCanvas;
