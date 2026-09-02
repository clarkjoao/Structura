import { useMemo, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  PanOnScrollMode,
  ReactFlow,
  ReactFlowProvider,
} from "@xyflow/react";
import type { Diagram } from "@/features/diagram/model";
import { buildFlowOutline } from "@/features/diagram";
import FlowStepNavigator from "@/features/canvas/flow/FlowStepNavigator";
import { useFlowModePlayback } from "@/features/canvas/flow/useFlowModePlayback";
import type { FlowMode } from "@/features/canvas/flow/flowMode.types";
import {
  buildFlowBadges,
  buildFlowHighlight,
  EMPTY_FLOW_HIGHLIGHT,
} from "@/features/canvas/flow/flowState";
import { EMBED_EDGE_TYPES, EMBED_NODE_TYPES } from "./embedNodeTypes";
import { OpenInStructuraButton } from "./OpenInStructuraButton";
import { FlowInvite } from "./FlowInvite";
import { useDiagramToFlow } from "../hooks/useDiagramToFlow";
import "./ViewerCanvas.css";

/** Stable identity, so the reading memo is not rebuilt on every render. */
const EMPTY_HISTORY: string[] = [];

interface ViewerCanvasProps {
  diagram: Diagram;
  offsetTop?: number;
  showOpenInStructuraButton?: boolean;
}

const ViewerCanvasContent = ({
  diagram,
  offsetTop = 0,
  showOpenInStructuraButton = true,
}: ViewerCanvasProps) => {
  const flows = useMemo(() => Object.values(diagram.snapshot.flows ?? {}), [diagram]);

  /**
   * The reading, held here rather than in the editor's store: the viewer has
   * no store, and this is the same state machine the editor drives.
   */
  const [mode, setMode] = useState<FlowMode>({ kind: "idle" });
  const playback = useFlowModePlayback(mode, setMode);
  const playing = mode.kind === "playing" ? mode : null;
  const readingFlow = playing?.flow ?? null;

  /**
   * What the canvas shows of the reading: the numbers, and where the reader
   * is. Null while nothing is open, and then the canvas carries no numbers —
   * the open script is what numbers it.
   */
  const reading = useMemo(() => {
    if (!readingFlow) return null;
    const rows = buildFlowOutline(readingFlow).rows;
    return {
      badges: rows.length > 0 ? buildFlowBadges(readingFlow, rows) : null,
      highlight: playing?.currentStepId
        ? buildFlowHighlight(readingFlow, playing.currentStepId, playing.history)
        : EMPTY_FLOW_HIGHLIGHT,
    };
  }, [readingFlow, playing?.currentStepId, playing?.history]);

  const { nodes, edges } = useDiagramToFlow(diagram, reading);

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

      {!readingFlow && (
        <FlowInvite
          flows={flows}
          onSelect={(flowId) => {
            const target = flows.find((flow) => flow.id === flowId);
            if (target) playback.play(target);
          }}
        />
      )}

      {readingFlow && (
        <FlowStepNavigator
          flow={readingFlow}
          diagram={diagram}
          currentStepId={playing?.currentStepId ?? null}
          currentStep={playback.currentStep}
          history={playing?.history ?? EMPTY_HISTORY}
          flows={flows}
          onSelectFlow={(flowId) => {
            const target = flows.find((flow) => flow.id === flowId);
            if (target) playback.switchFlow(target);
          }}
          isCondition={playback.isCondition}
          canGoBack={playback.canGoBack}
          canGoForward={playback.canGoForward}
          onGoNext={playback.goNext}
          onGoBack={playback.goBack}
          onChooseBranch={playback.chooseBranch}
          onExit={playback.exitPlay}
        />
      )}

      {showOpenInStructuraButton && <OpenInStructuraButton diagram={diagram} />}
    </div>
  );
};

export const ViewerCanvas = ({
  diagram,
  offsetTop = 0,
  showOpenInStructuraButton = true,
}: ViewerCanvasProps) => (
  <ReactFlowProvider>
    <ViewerCanvasContent
      diagram={diagram}
      offsetTop={offsetTop}
      showOpenInStructuraButton={showOpenInStructuraButton}
    />
  </ReactFlowProvider>
);
