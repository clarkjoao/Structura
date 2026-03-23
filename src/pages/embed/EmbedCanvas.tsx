import {
  Background,
  BackgroundVariant,
  Controls,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import type { Diagram } from "@/features/diagram";
import { EMBED_EDGE_TYPES, EMBED_NODE_TYPES } from "./embedNodeTypes";
import { OpenInStructuraButton } from "./OpenInStructuraButton";
import { useDiagramToFlow } from "./useDiagramToFlow";

interface EmbedCanvasProps {
  diagram: Diagram;
}

const EmbedCanvasContent = ({ diagram }: EmbedCanvasProps) => {
  const { nodes, edges } = useDiagramToFlow(diagram);

  return (
    <div style={{ width: "100%", height: "100vh", position: "relative" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={EMBED_NODE_TYPES}
        edgeTypes={EMBED_EDGE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.1 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnScroll={false}
        zoomOnDoubleClick={false}
        panOnDrag
        zoomOnScroll
        minZoom={0.1}
        maxZoom={4}
        proOptions={{ hideAttribution: false }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--color-border-tertiary)"
        />
        <Controls showInteractive={false} position="bottom-right" />
      </ReactFlow>
      <OpenInStructuraButton diagramName={diagram.name} />
    </div>
  );
};

export const EmbedCanvas = ({ diagram }: EmbedCanvasProps) => (
  <ReactFlowProvider>
    <EmbedCanvasContent diagram={diagram} />
  </ReactFlowProvider>
);
