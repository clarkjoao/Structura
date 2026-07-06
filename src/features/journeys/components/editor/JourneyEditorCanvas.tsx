import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useTranslation } from "react-i18next";
import {
  Background,
  BackgroundVariant,
  Controls,
  type Edge,
  type Node,
  PanOnScrollMode,
  ReactFlow,
  ReactFlowProvider,
  SmoothStepEdge,
  useReactFlow,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { GitBranch } from "lucide-react";
import {
  getStepById,
  isEndpointType,
  isJsonViewerType,
  isNoteType,
  isReactFlowParentPanelType,
  useActiveDiagramId,
  useDiagrams,
} from "@/features/diagram";
import type { Flow } from "@/features/diagram";
import {
  EditableEdge,
  FlowStepNavigator,
  FIT_VIEW_DURATION_MS,
  FIT_VIEW_MAX_ZOOM,
  FIT_VIEW_PADDING,
  nodeTypes,
  useFlowMode,
  useFlowState,
} from "@/features/canvas";
import type { JourneyStep } from "../../types";
import { stepHasVisualMedia } from "../../utils/step-media.utils";
import {
  buildJourneyEditorEdges,
  buildJourneyEditorNodes,
  type JourneyEditorCanvasFlowVisuals,
} from "./journeyEditorCanvas.utils";
import { StepDescriptionBadge } from "./StepDescriptionBadge";
import { VisualStateOverlay } from "./VisualStateOverlay";

const journeyEdgeTypes = { editable: EditableEdge, smoothstep: SmoothStepEdge };

const emptyStateDotBackground: CSSProperties = {
  backgroundImage: "radial-gradient(hsl(var(--border)) 1px, transparent 1px)",
  backgroundSize: "18px 18px",
};

interface JourneyEditorCanvasProps {
  diagramId: string | null;

  hasSelectedStep: boolean;
  isGlobalPlaying?: boolean;
  showVisualOverlay?: boolean;
  selectedStep?: JourneyStep | null;
  onCloseVisualOverlay?: () => void;
  stepDescriptionProps?: {
    step: JourneyStep;
    stepIndex: number;
    totalSteps: number;
  } | null;
}

type JourneyEditorCanvasInnerProps = Omit<
  JourneyEditorCanvasProps,
  | "hasSelectedStep"
  | "showVisualOverlay"
  | "selectedStep"
  | "onCloseVisualOverlay"
  | "stepDescriptionProps"
>;

interface JourneyEditorPlaybackFitViewProps {
  diagramId: string;
  isPlaying: boolean;
  isRecording: boolean;
  activeFlow: Flow | null;
  currentStepId: string | null;
}

function JourneyEditorPlaybackFitView({
  diagramId,
  isPlaying,
  isRecording,
  activeFlow,
  currentStepId,
}: JourneyEditorPlaybackFitViewProps): null {
  const { fitView, getNode, getEdge } = useReactFlow();

  useEffect(() => {
    if (!isPlaying || isRecording) return;
    if (!activeFlow || activeFlow.diagramId !== diagramId || !currentStepId) {
      return;
    }
    const step = getStepById(activeFlow, currentStepId);
    if (!step) return;

    if (step.componentId) {
      const node = getNode(step.componentId);
      if (node) {
        void fitView({
          nodes: [{ id: step.componentId }],
          duration: FIT_VIEW_DURATION_MS,
          padding: FIT_VIEW_PADDING,
          maxZoom: FIT_VIEW_MAX_ZOOM,
        });
      }
    } else if (step.connectionId) {
      const edge = getEdge(step.connectionId);
      if (edge) {
        const sourceNode = getNode(edge.source);
        const targetNode = getNode(edge.target);
        if (sourceNode && targetNode) {
          void fitView({
            nodes: [{ id: edge.source }, { id: edge.target }],
            duration: FIT_VIEW_DURATION_MS,
            padding: FIT_VIEW_PADDING,
            maxZoom: FIT_VIEW_MAX_ZOOM,
          });
        }
      }
    }
  }, [activeFlow, currentStepId, diagramId, fitView, getEdge, getNode, isPlaying, isRecording]);

  return null;
}

interface JourneyEditorDiagramFitViewProps {
  diagramId: string;
}

function JourneyEditorDiagramFitView({ diagramId }: JourneyEditorDiagramFitViewProps): null {
  const { fitView } = useReactFlow();
  const prevDiagramIdRef = useRef<string | null>(null);

  useEffect(() => {
    if (prevDiagramIdRef.current === diagramId) {
      return;
    }
    prevDiagramIdRef.current = diagramId;
    const raf = requestAnimationFrame(() => {
      void fitView({
        duration: 400,
        padding: 0.12,
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [diagramId, fitView]);

  return null;
}

function JourneyEditorNoStepEmptyState() {
  const { t } = useTranslation();
  return (
    <div
      className="flex h-full w-full flex-col items-center justify-center gap-3 bg-muted/20 px-6 text-center"
      style={emptyStateDotBackground}
    >
      <GitBranch className="h-12 w-12 shrink-0 text-muted-foreground/40" aria-hidden />
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
  isGlobalPlaying = false,
}: JourneyEditorCanvasInnerProps) {
  const { t } = useTranslation();
  const diagramsRecord = useDiagrams();
  const activeDiagramIdStore = useActiveDiagramId();
  const flowMode = useFlowMode();

  const diagram = diagramId ? diagramsRecord[diagramId] : undefined;

  const diagramFlows = useMemo(
    () => (diagram ? Object.values(diagram.snapshot.flows) : []),
    [diagram],
  );

  const { isPlaying, activeFlow, currentStepId, flowHighlight, recordingInfo, activeStep } =
    useFlowState({ flows: diagramFlows });

  const isRecording = flowMode.isRecording;

  const flowVisuals = useMemo((): JourneyEditorCanvasFlowVisuals | null => {
    if (!diagram) return null;
    const recordingThisDiagram = isRecording && diagram.id === activeDiagramIdStore;
    const playingThisDiagram = isPlaying && activeFlow?.diagramId === diagram.id;
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

  const nodes = useMemo(() => {
    if (!diagram) return [];
    return buildJourneyEditorNodes(diagram, null, diagramsRecord, flowVisuals);
  }, [diagramsRecord, diagram, flowVisuals]);

  const edges = useMemo(() => {
    if (!diagram) return [];
    return buildJourneyEditorEdges(diagram, flowVisuals);
  }, [diagram, flowVisuals]);

  const handleNodeClick = useCallback(
    (_: ReactMouseEvent, node: Node) => {
      if (!isRecording) return;
      const recordingThisDiagram = diagram?.id === activeDiagramIdStore;
      if (!recordingThisDiagram) return;
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
    },
    [activeDiagramIdStore, diagram?.id, flowMode, isRecording],
  );

  const handleEdgeClick = useCallback(
    (_: ReactMouseEvent, edge: Edge) => {
      const recordingThisDiagram = isRecording && diagram?.id === activeDiagramIdStore;
      if (recordingThisDiagram) {
        flowMode.onRecordEdgeClick(edge.id, edge.sourceHandle ?? undefined);
      }
    },
    [activeDiagramIdStore, diagram?.id, flowMode, isRecording],
  );

  if (!diagramId || !diagram) {
    return (
      <div className="flex h-full w-full items-center justify-center bg-muted/20">
        <p className="text-sm text-muted-foreground">{t("journeys.editor.selectDiagram")}</p>
      </div>
    );
  }

  const showFlowNavigator =
    flowMode.isPlaying &&
    activeFlow &&
    activeFlow.diagramId === diagramId &&
    currentStepId !== null;

  const showRecordingOverlay = isRecording && diagram.id === activeDiagramIdStore;

  const topCanvasHint = showFlowNavigator
    ? null
    : showRecordingOverlay
      ? t("journeys.editor.recordingCanvasHint")
      : null;

  const elementsSelectable = isRecording || isPlaying;

  return (
    <div className="relative h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        edgeTypes={journeyEdgeTypes}
        onNodeClick={handleNodeClick}
        onEdgeClick={handleEdgeClick}
        fitView
        fitViewOptions={{ padding: 0.12 }}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={elementsSelectable}
        deleteKeyCode={null}
        zoomOnScroll={false}
        panOnScroll
        panOnScrollMode={PanOnScrollMode.Free}
        proOptions={{ hideAttribution: true }}
        className="bg-background"
      >
        <JourneyEditorDiagramFitView diagramId={diagramId} />
        <JourneyEditorPlaybackFitView
          diagramId={diagramId}
          isPlaying={isPlaying}
          isRecording={isRecording}
          activeFlow={activeFlow}
          currentStepId={currentStepId}
        />
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
      {isGlobalPlaying ? (
        <div className="pointer-events-none absolute bottom-14 left-1/2 z-10 -translate-x-1/2">
          <div className="rounded-full border border-border bg-card/80 px-3 py-1 text-[10px] text-muted-foreground backdrop-blur-sm">
            {t("journeys.presentation.keyboardHint")}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function JourneyEditorCanvas({
  hasSelectedStep,
  showVisualOverlay = false,
  selectedStep = null,
  onCloseVisualOverlay,
  stepDescriptionProps = null,
  ...innerProps
}: JourneyEditorCanvasProps) {
  if (!hasSelectedStep) {
    return <JourneyEditorNoStepEmptyState />;
  }
  return (
    <div className="relative h-full w-full">
      <ReactFlowProvider>
        <JourneyEditorCanvasInner {...innerProps} />
      </ReactFlowProvider>
      {stepDescriptionProps ? <StepDescriptionBadge {...stepDescriptionProps} /> : null}
      {showVisualOverlay && selectedStep && stepHasVisualMedia(selectedStep) ? (
        <VisualStateOverlay step={selectedStep} onClose={onCloseVisualOverlay ?? (() => {})} />
      ) : null}
    </div>
  );
}
