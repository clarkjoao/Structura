import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  applyEdgeChanges,
  applyNodeChanges,
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type EdgeChange,
  type Node,
  type NodeChange,
  PanOnScrollMode,
  ReactFlow,
  ReactFlowProvider,
  SmoothStepEdge,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GitBranch } from "lucide-react";
import {
  isEndpointType,
  isJsonViewerType,
  isNoteType,
  isReactFlowParentPanelType,
  useActiveDiagramId,
  useDiagrams,
} from "@/features/diagram";
import CustomEdge from "@/features/canvas/edges/CustomEdge";
import FlowStepNavigator from "@/features/canvas/flow/FlowStepNavigator";
import { useFlowMode, useFlowState } from "@/features/canvas/flow";
import { nodeTypes } from "@/features/canvas/nodes/node-types";
import {
  buildJourneyEditorEdges,
  buildJourneyEditorNodes,
  type JourneyEditorCanvasFlowVisuals,
} from "./journeyEditorCanvas.utils";

const journeyEdgeTypes = { c4: CustomEdge, smoothstep: SmoothStepEdge };

const emptyStateDotBackground: CSSProperties = {
  backgroundImage:
    "radial-gradient(hsl(var(--border)) 1px, transparent 1px)",
  backgroundSize: "18px 18px",
};

interface JourneyEditorCanvasProps {
  diagramId: string | null;
  /** When false, the diagram canvas is hidden in favor of an empty state. */
  hasSelectedStep: boolean;
  selectedStepId: string | null;
  selectedComponentId: string | null;
  onSelectComponent: (componentId: string, name: string) => void;
  /** When this step id changes and `fitComponentId` is set, canvas pans to that node. */
  fitOnStepId: string | null;
  fitComponentId: string | null;
}

type JourneyEditorCanvasInnerProps = Omit<
  JourneyEditorCanvasProps,
  "hasSelectedStep"
>;

function JourneyEditorNoStepEmptyState() {
  const { t } = useTranslation();
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-3 bg-muted/20 px-6 text-center"
      style={emptyStateDotBackground}
    >
      <GitBranch
        className="h-12 w-12 shrink-0 text-muted-foreground/40"
        aria-hidden
      />
      <p className="max-w-sm text-base font-medium text-muted-foreground">
        {t("journeys.editor.emptyStateTitle")}
      </p>
      <p className="max-w-sm text-sm text-muted-foreground/70">
        {t("journeys.editor.emptyStateSubtitle")}
      </p>
    </div>
  );
}

function JourneyEditorCanvasInner({
  diagramId,
  selectedStepId,
  selectedComponentId,
  onSelectComponent,
  fitOnStepId,
  fitComponentId,
}: JourneyEditorCanvasInnerProps) {
  const { t } = useTranslation();
  const { fitView } = useReactFlow();
  const diagramsRecord = useDiagrams();
  const activeDiagramIdStore = useActiveDiagramId();
  const flowMode = useFlowMode();

  const diagram = diagramId ? diagramsRecord[diagramId] : undefined;

  const diagramFlows = useMemo(
    () => (diagram ? Object.values(diagram.snapshot.flows) : []),
    [diagram],
  );

  const {
    isPlaying,
    activeFlow,
    currentStepId,
    flowHighlight,
    recordingInfo,
    activeStep,
  } = useFlowState({ flows: diagramFlows });

  const isRecording = flowMode.isRecording;

  const flowVisuals = useMemo((): JourneyEditorCanvasFlowVisuals | null => {
    if (!diagram) return null;
    const recordingThisDiagram =
      isRecording && diagram.id === activeDiagramIdStore;
    const playingThisDiagram =
      isPlaying && activeFlow?.diagramId === diagram.id;
    if (!recordingThisDiagram && !playingThisDiagram) return null;
    return {
      isPlaying: playingThisDiagram,
      isRecording: recordingThisDiagram,
      flowHighlight,
      activeStep,
      recordingInfo,
      onRecordHandleClick: flowMode.onRecordHandleClick,
    };
  }, [
    activeDiagramIdStore,
    activeFlow?.diagramId,
    activeStep,
    diagram,
    flowHighlight,
    flowMode.onRecordHandleClick,
    isPlaying,
    isRecording,
    recordingInfo,
  ]);

  const computedNodes = useMemo(() => {
    if (!diagram) return [];
    return buildJourneyEditorNodes(
      diagram,
      selectedComponentId,
      diagramsRecord,
      flowVisuals,
    );
  }, [diagramsRecord, diagram, flowVisuals, selectedComponentId]);

  const computedEdges = useMemo(() => {
    if (!diagram) return [];
    return buildJourneyEditorEdges(diagram, flowVisuals);
  }, [diagram, flowVisuals]);

  const [nodes, setNodes] = useState<Node[]>(computedNodes);
  const [edges, setEdges] = useState<Edge[]>(computedEdges);

  useEffect(() => {
    setNodes(computedNodes);
  }, [computedNodes]);

  useEffect(() => {
    setEdges(computedEdges);
  }, [computedEdges]);

  useEffect(() => {
    if (!fitOnStepId || !fitComponentId) return;
    void fitView({
      nodes: [{ id: fitComponentId }],
      duration: 300,
      padding: 0.2,
    });
  }, [fitComponentId, fitOnStepId, fitView]);

  const onNodesChange = useCallback((changes: NodeChange[]) => {
    setNodes((previous) => applyNodeChanges(changes, previous));
  }, []);

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    setEdges((previous) => applyEdgeChanges(changes, previous));
  }, []);

  const flowBlocksJourneyGestures =
    flowMode.isPlaying || flowMode.isRecording;

  const handleNodeClick = useCallback(
    (_: ReactMouseEvent, node: Node) => {
      const recordingThisDiagram =
        isRecording && diagram?.id === activeDiagramIdStore;

      if (flowBlocksJourneyGestures) {
        if (recordingThisDiagram) {
          const nodeType = (node.type as string) ?? "";
          if (isEndpointType(nodeType) && node.parentId) {
            flowMode.onRecordNodeClick(node.id);
            return;
          }
          if (
            !isReactFlowParentPanelType(nodeType) &&
            !isNoteType(nodeType) &&
            !isJsonViewerType(nodeType)
          ) {
            flowMode.onRecordNodeClick(node.id);
          }
        }
        return;
      }

      const nodeName =
        typeof node.data.name === "string"
          ? node.data.name
          : String(node.data.name ?? "");
      onSelectComponent(node.id, nodeName);
    },
    [
      activeDiagramIdStore,
      diagram?.id,
      flowBlocksJourneyGestures,
      flowMode,
      isRecording,
      onSelectComponent,
    ],
  );

  const handleEdgeClick = useCallback(
    (_: ReactMouseEvent, edge: Edge) => {
      const recordingThisDiagram =
        isRecording && diagram?.id === activeDiagramIdStore;
      if (recordingThisDiagram) {
        flowMode.onRecordEdgeClick(edge.id, edge.sourceHandle ?? undefined);
      }
    },
    [activeDiagramIdStore, diagram?.id, flowMode, isRecording],
  );

  if (!diagramId || !diagram) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/20">
        <p className="text-sm text-muted-foreground">
          {t("journeys.editor.selectDiagram")}
        </p>
      </div>
    );
  }

  const showFlowNavigator =
    flowMode.isPlaying &&
    activeFlow &&
    activeFlow.diagramId === diagramId &&
    currentStepId !== null;

  const showRecordingOverlay =
    isRecording && diagram.id === activeDiagramIdStore;

  const topCanvasHint = showFlowNavigator
    ? null
    : showRecordingOverlay
      ? t("journeys.editor.recordingCanvasHint")
      : t("journeys.editor.canvasHint");

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        edgeTypes={journeyEdgeTypes}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={!flowBlocksJourneyGestures}
        deleteKeyCode={null}
        zoomOnScroll={false}
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Free}
        proOptions={{ hideAttribution: true }}
        className="bg-background"
      >
        <Background variant={BackgroundVariant.Dots} gap={18} size={1.5} />
        <Controls className="!bg-card !border-border !rounded-lg !shadow-lg [&>button]:!bg-card [&>button]:!border-border [&>button]:!text-muted-foreground [&>button:hover]:!bg-surface-hover [&>button]:!rounded-md [&>button]:!w-8 [&>button]:!h-8" />
      </ReactFlow>
      {showFlowNavigator && activeFlow && currentStepId ? (
        <FlowStepNavigator
          flow={activeFlow}
          currentStepId={currentStepId}
          currentStep={flowMode.currentStep}
          isCondition={flowMode.isCondition}
          canGoBack={flowMode.canGoBack}
          canGoForward={flowMode.canGoForward}
          onGoNext={flowMode.goNext}
          onGoBack={flowMode.goBack}
          onChooseBranch={flowMode.chooseBranch}
          onExit={flowMode.exitPlay}
        />
      ) : null}
      {topCanvasHint !== null ? (
        <div className="pointer-events-none absolute left-1/2 top-2 z-10 -translate-x-1/2">
          <div className="pointer-events-none rounded-full border border-border bg-card/90 px-3 py-1 text-xs text-muted-foreground backdrop-blur-sm">
            {topCanvasHint}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function JourneyEditorCanvas({
  hasSelectedStep,
  ...innerProps
}: JourneyEditorCanvasProps) {
  if (!hasSelectedStep) {
    return <JourneyEditorNoStepEmptyState />;
  }
  return (
    <ReactFlowProvider>
      <JourneyEditorCanvasInner {...innerProps} />
    </ReactFlowProvider>
  );
}
