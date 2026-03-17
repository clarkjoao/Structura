import { useState, useEffect, useCallback } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Clipboard, Download, GitBranch, CircleHelp } from "lucide-react";
import Navbar from "@/components/Navbar";
import ShortcutsModal from "@/components/ShortcutsModal";
import { Canvas, FlowPanel, FlowStepNavigator, FlowRecorderPanel } from "@/features/canvas";
import { RecordingModeStateProvider, useRecordingMode } from "@/features/canvas/flow/RecordingModeContext";
import { FlowPlaybackProvider, useFlowPlayback } from "@/features/canvas/flow/FlowPlaybackContext";
import { useActiveDiagram, useActiveDiagramId, useDiagramActions, useFlows, stepsToMermaid, useServiceRegistry } from "@/features/diagram";
import { exportJSON, exportDrawio, exportMermaid, downloadFile } from "@/lib/export-service";
import type { Flow } from "@/features/diagram";

function ModelExplorerContent({
  showFlows,
  setShowFlows,
  isViewingCoverage,
  setIsViewingCoverage,
  showShortcuts,
  setShowShortcuts,
  navStack,
  handleOpenDiagram,
  handleDrillUp,
  handleCopyDrawio,
  handleExport,
  copied,
  flows,
}: {
  showFlows: boolean;
  setShowFlows: (v: boolean) => void;
  isViewingCoverage: boolean;
  setIsViewingCoverage: (v: boolean | ((prev: boolean) => boolean)) => void;
  showShortcuts: boolean;
  setShowShortcuts: (v: boolean) => void;
  navStack: string[];
  handleOpenDiagram: (id: string) => void;
  handleDrillUp: () => void;
  handleCopyDrawio: () => void;
  handleExport: () => void;
  copied: boolean;
  flows: Flow[];
}) {
  const diagram = useActiveDiagram();
  const { isRecording, editingFlowId, startRecording, cancelRecording, finalizeRecording, ...recordingProps } = useRecordingMode();
  const { activeFlow, currentStep, isPlaying, play, exit, prev, next, goToStep } = useFlowPlayback();

  const disabledWhileBusy = isRecording || isPlaying;

  return (
    <>
      <div className="border-b border-border bg-card shrink-0 mt-16">
        <div className="container flex items-center justify-between h-12">
          <div className="flex items-center gap-3 text-sm">
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            {diagram?.domain && <span className="text-muted-foreground">{diagram.domain}</span>}
            <span className="font-medium">{diagram?.name}</span>
            {activeFlow && (
              <span className="text-[10px] font-mono text-primary bg-primary/10 rounded px-1.5 py-0.5">
                ▶ {activeFlow.name}{activeFlow.description ? ` · "${activeFlow.description}"` : ""}
              </span>
            )}
            {isRecording && (
              <span className={`text-[10px] font-mono rounded px-1.5 py-0.5 animate-pulse ${
                editingFlowId ? "text-amber-400 bg-amber-400/10" : "text-red-400 bg-red-400/10"
              }`}>
                {editingFlowId ? "✎ EDIT" : "● REC"}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { if (!disabledWhileBusy) setShowFlows(!showFlows); }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                showFlows ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
              } ${disabledWhileBusy ? "opacity-50 pointer-events-none" : ""}`}
            >
              <GitBranch className="h-3.5 w-3.5" /> Flows
            </button>
            <button
              onClick={handleCopyDrawio}
              disabled={disabledWhileBusy}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-transparent hover:border-border transition-all ${disabledWhileBusy ? "opacity-50 pointer-events-none" : ""}`}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Clipboard className="h-3.5 w-3.5" />}
              {copied ? "Copiado!" : "Copy"}
            </button>
            <button
              onClick={handleExport}
              disabled={disabledWhileBusy}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-transparent hover:border-border transition-all ${disabledWhileBusy ? "opacity-50 pointer-events-none" : ""}`}
            >
              <Download className="h-3.5 w-3.5" /> Exportar
            </button>
            <button
              onClick={() => setShowShortcuts(true)}
              disabled={disabledWhileBusy}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-transparent hover:border-border transition-all ${disabledWhileBusy ? "opacity-50 pointer-events-none" : ""}`}
              aria-label="Atalhos"
              title="Atalhos"
            >
              <CircleHelp className="h-3.5 w-3.5" /> Atalhos
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <ShortcutsModal open={showShortcuts} onOpenChange={setShowShortcuts} />
        <ReactFlowProvider>
          <div className="flex-1 flex flex-col relative">
            <Canvas
              onOpenDiagram={handleOpenDiagram}
              onDrillUp={navStack.length > 0 ? handleDrillUp : undefined}
              isViewingCoverage={isViewingCoverage}
              isFlowPanelOpen={showFlows}
              onPlayFlow={(flowId) => {
                const flow = flows.find((f) => f.id === flowId);
                if (flow) play(flow);
              }}
            />
            {activeFlow && (
              <FlowStepNavigator flow={activeFlow} currentStep={currentStep} onPrev={prev} onNext={next} onExit={exit} onGoToStep={goToStep} />
            )}
          </div>
        </ReactFlowProvider>
        {isRecording && (
          <FlowRecorderPanel
            name={recordingProps.recordingName}
            onNameChange={recordingProps.setRecordingName}
            description={recordingProps.recordingDescription}
            onDescriptionChange={recordingProps.setRecordingDescription}
            tags={recordingProps.recordingTags}
            onAddTag={recordingProps.onAddTag}
            onRemoveTag={recordingProps.onRemoveTag}
            steps={recordingProps.recordingSteps}
            onCancel={cancelRecording}
            onFinalize={finalizeRecording}
            onUpdateStepDescription={recordingProps.onUpdateStepDescription}
            onUpdateStepDuration={recordingProps.onUpdateStepDuration}
            onUpdateStepPayload={recordingProps.onUpdateStepPayload}
            onUpdateStepPayloadDirection={recordingProps.onUpdateStepPayloadDirection}
            onDeleteStep={recordingProps.onDeleteStep}
            onReorderSteps={recordingProps.onReorderSteps}
            isEditing={!!editingFlowId}
          />
        )}
        {showFlows && !activeFlow && !isRecording && (
          <FlowPanel
            onClose={() => setShowFlows(false)}
            onPlay={play}
            onStartRecording={startRecording}
            onEditFlow={recordingProps.editFlow}
            isViewingCoverage={isViewingCoverage}
            onToggleCoverage={() => setIsViewingCoverage((v) => !v)}
          />
        )}
      </div>
    </>
  );
}

const ModelExplorer = () => {
  const diagram = useActiveDiagram();
  const activeDiagramId = useActiveDiagramId();
  const { openDiagram, addFlow, updateFlow } = useDiagramActions();
  const flows = useFlows();
  const serviceRegistry = useServiceRegistry();
  const navigate = useNavigate();
  const [showFlows, setShowFlows] = useState(false);
  const [isViewingCoverage, setIsViewingCoverage] = useState(false);
  const [activeFlow, setActiveFlow] = useState<Flow | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [navStack, setNavStack] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const handleOpenDiagram = useCallback(
    (id: string) => {
      if (activeDiagramId) setNavStack((prev) => [...prev, activeDiagramId]);
      openDiagram(id);
      navigate(`/model/${id}`);
    },
    [activeDiagramId, openDiagram, navigate],
  );

  const handleDrillUp = useCallback(() => {
    const prev = navStack[navStack.length - 1];
    if (!prev) return;
    setNavStack((s) => s.slice(0, -1));
    openDiagram(prev);
    navigate(`/model/${prev}`);
  }, [navStack, openDiagram, navigate]);

  const handlePlay = useCallback((flow: Flow) => { setActiveFlow(flow); setCurrentStep(0); setShowFlows(false); }, []);
  const handleExit = useCallback(() => { setActiveFlow(null); setCurrentStep(0); }, []);
  const handlePrev = useCallback(() => { setCurrentStep((s) => Math.max(0, s - 1)); }, []);
  const handleNext = useCallback(() => { if (!activeFlow) return; setCurrentStep((s) => Math.min(activeFlow.steps.length - 1, s + 1)); }, [activeFlow]);
  const handleGoToStep = useCallback((i: number) => setCurrentStep(i), []);

  const handleFinalizeRecording = useCallback(
    (data: { name: string; description: string; tags: string[]; steps: import("@/features/diagram").FlowStep[]; editingFlowId: string | null }) => {
      if (!diagram) return;
      const mermaid = stepsToMermaid(data.steps, diagram.snapshot.components, diagram.snapshot.connections);
      const desc = data.description || undefined;
      const flowTags = data.tags.length ? data.tags : undefined;
      if (data.editingFlowId) {
        updateFlow(data.editingFlowId, { name: data.name || "Flow sem nome", mermaid, steps: data.steps, description: desc, tags: flowTags });
      } else {
        const flow = addFlow(diagram.id, data.name || "Flow sem nome", mermaid, data.steps);
        if (desc || flowTags) updateFlow(flow.id, { description: desc, tags: flowTags });
      }
    },
    [diagram, addFlow, updateFlow],
  );

  const handleCopyDrawio = useCallback(() => {
    if (!diagram) return;
    const xml = exportDrawio(diagram, serviceRegistry);
    navigator.clipboard.writeText(xml).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [diagram, serviceRegistry]);

  const handleExport = useCallback(() => {
    if (!diagram) return;
    const slug = diagram.name.toLowerCase().replace(/\s+/g, "-");
    downloadFile(exportJSON(diagram), `${slug}.json`, "application/json");
    downloadFile(exportDrawio(diagram, serviceRegistry), `${slug}.drawio`, "application/xml");
    if (flows.length > 0) {
      downloadFile(
        exportMermaid(flows, diagram.snapshot.components, diagram.snapshot.connections),
        `${slug}-flows.md`,
        "text/markdown",
      );
    }
  }, [diagram, flows, serviceRegistry]);

  useEffect(() => {
    if (!activeFlow) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") { e.preventDefault(); handleExit(); return; }
      if (e.key === "ArrowLeft") { e.preventDefault(); handlePrev(); return; }
      if (e.key === "ArrowRight") { e.preventDefault(); handleNext(); return; }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [activeFlow, handleExit, handlePrev, handleNext]);

  if (!diagram) {
    return (
      <div className="h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center mt-16">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">Nenhum diagrama selecionado.</p>
            <Link to="/dashboard" className="text-primary hover:underline text-sm">Voltar ao Dashboard</Link>
          </div>
        </div>
      </div>
    );
  }

  const playbackValue = {
    activeFlow,
    currentStep,
    isPlaying: !!activeFlow && currentStep >= 0,
    play: handlePlay,
    exit: handleExit,
    prev: handlePrev,
    next: handleNext,
    goToStep: handleGoToStep,
  };

  return (
    <div className="h-screen flex flex-col">
      <Navbar />
      <RecordingModeStateProvider
        onFinalize={handleFinalizeRecording}
        onStartRecording={() => setShowFlows(false)}
      >
        <FlowPlaybackProvider value={playbackValue}>
          <ModelExplorerContent
            showFlows={showFlows}
            setShowFlows={setShowFlows}
            isViewingCoverage={isViewingCoverage}
            setIsViewingCoverage={setIsViewingCoverage}
            showShortcuts={showShortcuts}
            setShowShortcuts={setShowShortcuts}
            navStack={navStack}
            handleOpenDiagram={handleOpenDiagram}
            handleDrillUp={handleDrillUp}
            handleCopyDrawio={handleCopyDrawio}
            handleExport={handleExport}
            copied={copied}
            flows={flows}
          />
        </FlowPlaybackProvider>
      </RecordingModeStateProvider>
    </div>
  );
};

export default ModelExplorer;
