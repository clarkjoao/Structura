import { useState, useEffect, useCallback } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, FileJson, GitBranch } from "lucide-react";
import Navbar from "@/components/Navbar";
import Canvas from "@/components/canvas/Canvas";
import FlowPanel from "@/components/canvas/FlowPanel";
import FlowStepNavigator from "@/components/canvas/FlowStepNavigator";
import FlowRecorderPanel, { stepsToMermaid } from "@/components/canvas/FlowRecorderPanel";
import { useActiveDiagram, useActiveDiagramId, useDiagramActions } from "@/lib/model-store";
import type { Flow, FlowStep } from "@/lib/model-types";

const ModelExplorer = () => {
  const diagram = useActiveDiagram();
  const activeDiagramId = useActiveDiagramId();
  const { openDiagram, addFlow } = useDiagramActions();
  const navigate = useNavigate();
  const [showFlows, setShowFlows] = useState(false);
  const [activeFlow, setActiveFlow] = useState<Flow | null>(null);
  const [currentStep, setCurrentStep] = useState(0);
  const [navStack, setNavStack] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSteps, setRecordingSteps] = useState<FlowStep[]>([]);
  const [recordingName, setRecordingName] = useState("");

  const handleOpenDiagram = useCallback(
    (id: string) => {
      if (activeDiagramId) {
        setNavStack((prev) => [...prev, activeDiagramId]);
      }
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

  const handlePlay = useCallback((flow: Flow) => {
    setActiveFlow(flow);
    setCurrentStep(0);
    setShowFlows(false);
  }, []);

  const handleExit = useCallback(() => {
    setActiveFlow(null);
    setCurrentStep(0);
  }, []);

  const handlePrev = useCallback(() => {
    setCurrentStep((s) => Math.max(0, s - 1));
  }, []);

  const handleNext = useCallback(() => {
    if (!activeFlow) return;
    setCurrentStep((s) => Math.min(activeFlow.steps.length - 1, s + 1));
  }, [activeFlow]);

  const handleStartRecording = useCallback(() => {
    setIsRecording(true);
    setShowFlows(false);
    setRecordingSteps([]);
    setRecordingName("");
  }, []);

  const handleCancelRecording = useCallback(() => {
    setIsRecording(false);
    setRecordingSteps([]);
    setRecordingName("");
  }, []);

  const handleFinalizeRecording = useCallback(() => {
    if (!diagram) return;
    const mermaid = stepsToMermaid(
      recordingSteps,
      diagram.snapshot.components,
      diagram.snapshot.connections,
    );
    addFlow(diagram.id, recordingName || "Flow sem nome", mermaid, recordingSteps);
    setIsRecording(false);
    setRecordingSteps([]);
    setRecordingName("");
  }, [diagram, recordingSteps, recordingName, addFlow]);

  const handleRecordNodeClick = useCallback((nodeId: string) => {
    setRecordingSteps((prev) => [
      ...prev,
      { order: prev.length, componentId: nodeId },
    ]);
  }, []);

  const handleRecordEdgeClick = useCallback((edgeId: string, handleId?: string) => {
    setRecordingSteps((prev) => [
      ...prev,
      { order: prev.length, connectionId: edgeId, handleId },
    ]);
  }, []);

  const handleRecordHandleClick = useCallback((nodeId: string, handleId: string) => {
    setRecordingSteps((prev) => [
      ...prev,
      { order: prev.length, componentId: nodeId, handleId },
    ]);
  }, []);

  const handleRecordUndo = useCallback(() => {
    setRecordingSteps((prev) => prev.slice(0, -1));
  }, []);

  const handleUpdateStepDescription = useCallback((index: number, description: string) => {
    setRecordingSteps((prev) =>
      prev.map((step, i) => (i === index ? { ...step, description } : step)),
    );
  }, []);

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

  return (
    <div className="h-screen flex flex-col">
      <Navbar />
      <div className="border-b border-border bg-card shrink-0 mt-16">
        <div className="container flex items-center justify-between h-12">
          <div className="flex items-center gap-3 text-sm">
            <Link to="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            {diagram.domain && <span className="text-muted-foreground">{diagram.domain}</span>}
            <span className="font-medium">{diagram.name}</span>
            {activeFlow && (
              <span className="text-[10px] font-mono text-primary bg-primary/10 rounded px-1.5 py-0.5">
                ▶ {activeFlow.name}
              </span>
            )}
            {isRecording && (
              <span className="text-[10px] font-mono text-red-400 bg-red-400/10 rounded px-1.5 py-0.5 animate-pulse">
                ● REC
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => { if (!isRecording) setShowFlows(!showFlows); }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                showFlows ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
              } ${isRecording ? "opacity-50 pointer-events-none" : ""}`}
            >
              <GitBranch className="h-3.5 w-3.5" /> Flows
            </button>
            <button className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-transparent hover:border-border transition-all">
              <FileJson className="h-3.5 w-3.5" /> Exportar
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <ReactFlowProvider>
          <div className="flex-1 flex flex-col relative">
            <Canvas
              activeFlow={activeFlow}
              currentStep={currentStep}
              onOpenDiagram={handleOpenDiagram}
              onDrillUp={navStack.length > 0 ? handleDrillUp : undefined}
              isRecording={isRecording}
              recordingSteps={recordingSteps}
              onRecordNodeClick={handleRecordNodeClick}
              onRecordEdgeClick={handleRecordEdgeClick}
              onRecordHandleClick={handleRecordHandleClick}
              onRecordUndo={handleRecordUndo}
            />
            {activeFlow && (
              <FlowStepNavigator
                flow={activeFlow}
                currentStep={currentStep}
                onPrev={handlePrev}
                onNext={handleNext}
                onExit={handleExit}
              />
            )}
          </div>
        </ReactFlowProvider>
        {isRecording && (
          <FlowRecorderPanel
            name={recordingName}
            onNameChange={setRecordingName}
            steps={recordingSteps}
            onCancel={handleCancelRecording}
            onFinalize={handleFinalizeRecording}
            onUpdateStepDescription={handleUpdateStepDescription}
          />
        )}
        {showFlows && !activeFlow && !isRecording && (
          <FlowPanel onClose={() => setShowFlows(false)} onPlay={handlePlay} onStartRecording={handleStartRecording} />
        )}
      </div>
    </div>
  );
};

export default ModelExplorer;
