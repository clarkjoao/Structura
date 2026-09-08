import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  Controls,
  PanOnScrollMode,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
} from "@xyflow/react";
import type { Diagram } from "@/features/diagram/model";
import {
  apiGroupFlows,
  buildFlowOutline,
  endpointCallersByRoute,
  endpointFlows,
  isApiGroupComponent,
  isEndpointComponent,
  resolveSceneSnapshot,
  type FlowRef,
} from "@/features/diagram";
import FlowReadingRail from "@/features/canvas/flow/reading/FlowReadingRail";
import { useFrameReadStep } from "@/features/canvas/flow/reading/useFrameReadStep";
import { useFlowReadingKeys } from "@/features/canvas/flow/reading/useFlowReadingKeys";
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
import { useDiagramToFlow, type ViewerRoutePlay } from "../hooks/useDiagramToFlow";
import "./ViewerCanvas.css";

/** Stable identity, so the reading memo is not rebuilt on every render. */
const EMPTY_HISTORY: string[] = [];

/** The rail's own width, which the canvas beside it has to leave room for. */
const RAIL_W = 392;

interface ViewerCanvasProps {
  diagram: Diagram;
  offsetTop?: number;
  showOpenInStructuraButton?: boolean;
  /**
   * The script the link asked to open on, if it named one.
   *
   * Checked against the diagram that arrived rather than trusted: a link kept
   * after its script was deleted names something that is not there, and the
   * honest outcome is the diagram with its own list, not a reading of nothing.
   */
  initialFlowId?: string | null;
}

const ViewerCanvasContent = ({
  diagram,
  offsetTop = 0,
  showOpenInStructuraButton = true,
  initialFlowId = null,
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

  /**
   * Starting a script from whatever the reader clicked.
   *
   * `play` only moves out of idle, so a route chosen while a script is already
   * open would otherwise do nothing at all — which is the one thing a reader
   * comparing two scripts would try.
   *
   * Held in a ref and handed out as a stable callback on purpose. It is built
   * into the data of every node, and the playback slice it closes over changes
   * identity on every step of a reading — so a plain `useCallback` rebuilt the
   * whole node array as the reader advanced, and React Flow answered by
   * re-measuring every node, blanking them for a frame each time.
   */
  const startRef = useRef<(flowId: string) => void>(() => {});
  startRef.current = (flowId: string) => {
    const target = flows.find((flow) => flow.id === flowId);
    if (!target) return;
    if (mode.kind === "playing") playback.switchFlow(target);
    else playback.play(target);
  };
  const startFlow = useCallback((flowId: string) => startRef.current(flowId), []);

  /**
   * What each route and each group offers, walked once for the diagram.
   *
   * The base snapshot, to match the nodes being drawn: the viewer resolves a
   * link onto the base whatever scene the author had open.
   */
  const routePlay = useMemo<ViewerRoutePlay>(() => {
    const components = resolveSceneSnapshot(diagram, null).components;
    const callsByRoute = endpointCallersByRoute(flows);
    const refs: FlowRef[] = flows.map((flow) => ({ id: flow.id, name: flow.name }));
    const flowsByComponent = new Map<string, FlowRef[]>();

    for (const component of Object.values(components)) {
      const associated = isEndpointComponent(component)
        ? endpointFlows(component, refs, callsByRoute)
        : isApiGroupComponent(component)
          ? apiGroupFlows(component.id, components, refs, callsByRoute)
          : [];
      if (associated.length > 0) flowsByComponent.set(component.id, associated);
    }

    return { flowsByComponent, onPlayFlow: startFlow };
  }, [diagram, flows, startFlow]);

  /** The link's own choice, honoured once — a reader who closes it stays closed. */
  const openedInitial = useRef(false);
  useEffect(() => {
    if (openedInitial.current || !initialFlowId) return;
    openedInitial.current = true;
    startFlow(initialFlowId);
  }, [initialFlowId, startFlow]);

  const { nodes, edges } = useDiagramToFlow(diagram, reading, routePlay);
  const reactFlowInstance = useReactFlow();

  /**
   * The canvas follows the reading. Without this a reader was told about a
   * node and left to find it — the rail said "Redirect API" and the diagram
   * stayed where it was, often with that node off-screen.
   */
  useFrameReadStep({
    reactFlowInstance,
    isReading: Boolean(readingFlow),
    flow: readingFlow,
    currentStepId: playing?.currentStepId ?? null,
  });

  /** The same keys the editor's reading answers to. */
  useFlowReadingKeys({
    isReading: Boolean(readingFlow),
    isCondition: playback.isCondition,
    onGoNext: playback.goNext,
    onGoBack: playback.goBack,
    onExit: playback.exitPlay,
    onStepOver: playback.stepOver,
    onStepOut: playback.stepOut,
  });

  return (
    <div
      style={{
        position: "relative",
        width: "100%",
        height: "100vh",
        paddingTop: offsetTop,
        boxSizing: "border-box",
      }}
    >
      {/*
        Beside the canvas, not over it. The rail is the same one the editor
        reads with — a reading is text, and text laid over the picture it
        describes hides half the answer.
      */}
      {readingFlow && (
        <div style={{ position: "absolute", top: offsetTop, bottom: 0, left: 0, zIndex: 10 }}>
          <FlowReadingRail
            flow={readingFlow}
            diagram={diagram}
            currentStepId={playing?.currentStepId ?? null}
            currentStep={playback.currentStep}
            history={playing?.history ?? EMPTY_HISTORY}
            seen={playing?.seen ?? EMPTY_HISTORY}
            flows={flows}
            onSelectFlow={startFlow}
            isCondition={playback.isCondition}
            canGoBack={playback.canGoBack}
            canGoForward={playback.canGoForward}
            onGoNext={playback.goNext}
            onGoBack={playback.goBack}
            onChooseBranch={playback.chooseBranch}
            onExit={playback.exitPlay}
            callStack={playback.callStack}
            canStepOver={playback.stepOverTarget !== null}
            onStepOver={playback.stepOver}
            stepOutFrameId={playback.stepOutFrameId}
            onStepOut={playback.stepOut}
            pinnedKeys={playing?.pinnedKeys ?? EMPTY_HISTORY}
            onTogglePin={playback.togglePinnedKey}
          />
        </div>
      )}
      {/*
        The canvas keeps the definite size it always had, and the rail is laid
        over its left edge rather than beside it in a flex row: React Flow
        measures its container once, and a flex child that resolves to nothing
        on the first pass leaves it measuring nothing for good — the diagram
        never fits, and neither the reading nor the fit button can move it.
      */}
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          paddingLeft: readingFlow ? RAIL_W : 0,
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

        {!readingFlow && <FlowInvite flows={flows} onSelect={startFlow} />}

        {showOpenInStructuraButton && <OpenInStructuraButton diagram={diagram} />}
      </div>
    </div>
  );
};

export const ViewerCanvas = ({
  diagram,
  offsetTop = 0,
  showOpenInStructuraButton = true,
  initialFlowId = null,
}: ViewerCanvasProps) => (
  <ReactFlowProvider>
    <ViewerCanvasContent
      diagram={diagram}
      offsetTop={offsetTop}
      showOpenInStructuraButton={showOpenInStructuraButton}
      initialFlowId={initialFlowId}
    />
  </ReactFlowProvider>
);
