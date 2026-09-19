import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { Edge, Node } from "@xyflow/react";
import type { Diagram } from "@/features/diagram/model";
import { buildFlowOutline } from "@/features/diagram";
import {
  DiagramControls,
  DiagramFlowProvider,
  DiagramSurface,
  readPolicy,
  useDiagramFlow,
  useReadDiagramFlow,
  withReaderFocus,
  type ReadDiagramRoutePlay,
} from "@/features/canvas/core";
import { HandleHighlightProvider } from "@/features/canvas/contexts/HandleHighlightContext";
import { useCanvasHighlight } from "@/features/canvas/hooks/useCanvasHighlight";
import {
  EMPTY_FLOW_HIGHLIGHT,
  FlowReadingRail,
  buildFlowBadges,
  buildFlowHighlight,
  useFlowModePlayback,
  useFlowReadingKeys,
  useFrameReadStep,
  type FlowMode,
} from "@/features/canvas/flow";
import { useNodeTypes } from "@/features/canvas/nodes/node-types";
import { OpenInStructuraButton } from "./OpenInStructuraButton";
import { FlowInvite } from "./FlowInvite";
import { iconLookupForDiagram } from "../icons/diagramIconLookup";
import "./ViewerCanvas.css";

/** Stable identity, so the reading memo is not rebuilt on every render. */
const EMPTY_HISTORY: string[] = [];
const NO_NODE_IDS: Set<string> = new Set();

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
  const nodeTypes = useNodeTypes();
  const iconLookup = useMemo(() => iconLookupForDiagram(diagram), [diagram]);
  const routePlay = useMemo<ReadDiagramRoutePlay>(() => ({ onPlayFlow: startFlow }), [startFlow]);

  /**
   * Click-to-focus on the shared canvas: expand a node's description, or
   * highlight an edge and its ends — same HandleHighlight path as the editor.
   */
  const { highlightedConnectionIds, highlightedNodeIds, setHighlight, clearHighlight } =
    useCanvasHighlight();
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(null);

  const handleNodeClick = useCallback(
    (_: MouseEvent, node: Node) => {
      clearHighlight();
      setFocusedNodeId((prev) => (prev === node.id ? null : node.id));
    },
    [clearHighlight],
  );

  const handleEdgeClick = useCallback(
    (_: MouseEvent, edge: Edge) => {
      setFocusedNodeId(null);
      if (highlightedConnectionIds.size === 1 && highlightedConnectionIds.has(edge.id)) {
        clearHighlight();
        return;
      }
      setHighlight(edge.id, [edge.source, edge.target]);
    },
    [highlightedConnectionIds, setHighlight, clearHighlight],
  );

  const handlePaneClick = useCallback(() => {
    setFocusedNodeId(null);
    clearHighlight();
  }, [clearHighlight]);

  /**
   * A panel's interior is canvas background (PanelNode, decision #1): it keeps
   * its click from React Flow, so a click there never reaches the pane. Seen
   * on the way down, it drops the focus as a click on the pane does.
   */
  const handleClickCapture = useCallback(
    (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest(".panel-body")) {
        handlePaneClick();
      }
    },
    [handlePaneClick],
  );

  const handleHighlightValue = useMemo(
    () => ({
      highlightedConnectionIds,
      highlightedNodeIds,
      setHighlight,
      clearHighlight,
    }),
    [highlightedConnectionIds, highlightedNodeIds, setHighlight, clearHighlight],
  );

  /** The link's own choice, honoured once — a reader who closes it stays closed. */
  const openedInitial = useRef(false);
  useEffect(() => {
    if (openedInitial.current || !initialFlowId) return;
    openedInitial.current = true;
    startFlow(initialFlowId);
  }, [initialFlowId, startFlow]);

  const {
    nodes: projectedNodes,
    edges,
    view,
  } = useReadDiagramFlow(diagram, reading, routePlay, focusedNodeId);
  const reactFlowInstance = useDiagramFlow();
  const focusedNodeIds = useMemo(
    () => (focusedNodeId ? new Set([focusedNodeId]) : NO_NODE_IDS),
    [focusedNodeId],
  );
  /** A focused node, or a highlighted edge's ends, keep the light; the rest dims, as in the editor. */
  const nodes = useMemo(
    () =>
      withReaderFocus(
        projectedNodes,
        view,
        focusedNodeIds,
        highlightedNodeIds,
        Boolean(readingFlow),
        (id) => reactFlowInstance.getInternalNode(id)?.measured,
      ),
    [projectedNodes, view, focusedNodeIds, highlightedNodeIds, readingFlow, reactFlowInstance],
  );

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
            onGoToStep={playback.goToStep}
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
        className="viewer-canvas"
        onClickCapture={handleClickCapture}
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          paddingLeft: readingFlow ? RAIL_W : 0,
          boxSizing: "border-box",
        }}
      >
        <HandleHighlightProvider value={handleHighlightValue}>
          <DiagramSurface
            policy={readPolicy()}
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            iconLookup={iconLookup}
            fitView
            onNodeClick={handleNodeClick}
            onEdgeClick={handleEdgeClick}
            onPaneClick={handlePaneClick}
          >
            <DiagramControls className="!bg-card !border-border !rounded-lg !shadow-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-muted-foreground [&>button:hover]:!bg-surface-hover [&>button]:!rounded-md [&>button]:!w-8 [&>button]:!h-8" />
          </DiagramSurface>
        </HandleHighlightProvider>

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
  <DiagramFlowProvider>
    <ViewerCanvasContent
      diagram={diagram}
      offsetTop={offsetTop}
      showOpenInStructuraButton={showOpenInStructuraButton}
      initialFlowId={initialFlowId}
    />
  </DiagramFlowProvider>
);
