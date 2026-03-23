import {
  Background,
  BackgroundVariant,
  Controls,
  PanOnScrollMode,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import type { Diagram } from "@/features/diagram";
import { EMBED_EDGE_TYPES, EMBED_NODE_TYPES } from "./embedNodeTypes";
import { OpenInStructuraButton } from "./OpenInStructuraButton";
import { useDiagramToFlow } from "./useDiagramToFlow";
import "./EmbedCanvas.css";

interface EmbedCanvasProps {
  diagram: Diagram;
  offsetTop?: number;
  showOpenInStructuraButton?: boolean;
}

const EmbedCanvasContent = ({
  diagram,
  offsetTop = 0,
  showOpenInStructuraButton = true,
}: EmbedCanvasProps) => {
  const { nodes, edges } = useDiagramToFlow(diagram);

  return (
    <div
      style={{
        width: "100%",
        height: "100vh",
        position: "relative",
        paddingTop: offsetTop,
        boxSizing: "border-box",
      }}
    >
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={EMBED_NODE_TYPES}
        edgeTypes={EMBED_EDGE_TYPES}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        panOnDrag
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Free}
        zoomOnScroll
        zoomOnPinch
        zoomOnDoubleClick={false}
        minZoom={0.3}
        maxZoom={1.5}
        proOptions={{ hideAttribution: true }}
        className="bg-background"
      >
       <Background variant={BackgroundVariant.Dots} gap={18} size={1.5} />
       <Controls className="!bg-card !border-border !rounded-lg !shadow-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-muted-foreground [&>button:hover]:!bg-surface-hover [&>button]:!rounded-md [&>button]:!w-8 [&>button]:!h-8" />
      </ReactFlow>
      {showOpenInStructuraButton ? (
        <OpenInStructuraButton diagramName={diagram.name} />
      ) : null}
    </div>
  );
};

export const EmbedCanvas = ({
  diagram,
  offsetTop = 0,
  showOpenInStructuraButton = true,
}: EmbedCanvasProps) => (
  <ReactFlowProvider>
    <EmbedCanvasContent
      diagram={diagram}
      offsetTop={offsetTop}
      showOpenInStructuraButton={showOpenInStructuraButton}
    />
  </ReactFlowProvider>
);
