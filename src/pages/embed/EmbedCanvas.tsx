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
        minZoom={0.05}
        maxZoom={4}
        proOptions={{ hideAttribution: false }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={20}
          size={1}
          color="var(--color-border-tertiary)"
        />
        <Controls
          position="bottom-right"
          showZoom
          showFitView
          showInteractive={false}
        />
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
