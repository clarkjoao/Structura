import { useState, useEffect, useCallback } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Check, Clipboard, Download, GitBranch } from "lucide-react";
import Navbar from "@/components/Navbar";
import { Canvas, FlowPanel, FlowStepNavigator, FlowRecorderPanel } from "@/features/canvas";
import { RecordingModeProvider } from "@/features/canvas/flow/RecordingModeContext";
import { useActiveDiagram, useActiveDiagramId, useDiagramActions, useFlows, stepsToMermaid, useServiceRegistry } from "@/features/diagram";
import { exportJSON, exportDrawio, exportMermaid, downloadFile } from "@/lib/export-service";
import type { Flow, FlowStep } from "@/features/diagram";

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
  const [navStack, setNavStack] = useState<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSteps, setRecordingSteps] = useState<FlowStep[]>([]);
  const [recordingName, setRecordingName] = useState("");
  const [recordingDescription, setRecordingDescription] = useState("");
  const [recordingTags, setRecordingTags] = useState<string[]>([]);
  const [editingFlowId, setEditingFlowId] = useState<string | null>(null);

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

  const resetRecordingState = useCallback(() => {
    setIsRecording(false);
    setRecordingSteps([]);
    setRecordingName("");
    setRecordingDescription("");
    setRecordingTags([]);
    setEditingFlowId(null);
  }, []);

  const handleStartRecording = useCallback(() => {
    resetRecordingState();
    setIsRecording(true);
    setShowFlows(false);
  }, [resetRecordingState]);

  const handleEditFlow = useCallback((flow: Flow) => {
    setIsRecording(true);
    setRecordingName(flow.name);
    setRecordingDescription(flow.description ?? "");
    setRecordingTags([...(flow.tags ?? [])]);
    setRecordingSteps([...flow.steps]);
    setEditingFlowId(flow.id);
    setShowFlows(false);
  }, []);

  const handleCancelRecording = useCallback(() => { resetRecordingState(); }, [resetRecordingState]);

  const handleFinalizeRecording = useCallback(() => {
    if (!diagram) return;
    const mermaid = stepsToMermaid(recordingSteps, diagram.snapshot.components, diagram.snapshot.connections);
    const desc = recordingDescription || undefined;
    const flowTags = recordingTags.length ? recordingTags : undefined;
    if (editingFlowId) {
      updateFlow(editingFlowId, { name: recordingName || "Flow sem nome", mermaid, steps: recordingSteps, description: desc, tags: flowTags });
    } else {
      const flow = addFlow(diagram.id, recordingName || "Flow sem nome", mermaid, recordingSteps);
      if (desc || flowTags) updateFlow(flow.id, { description: desc, tags: flowTags });
    }
    resetRecordingState();
  }, [diagram, recordingSteps, recordingName, recordingDescription, recordingTags, addFlow, updateFlow, editingFlowId, resetRecordingState]);

  const handleRecordNodeClick = useCallback((nodeId: string) => {
    setRecordingSteps((prev) => [...prev, { order: prev.length, componentId: nodeId }]);
  }, []);
  const handleRecordEdgeClick = useCallback((edgeId: string, handleId?: string) => {
    setRecordingSteps((prev) => [...prev, { order: prev.length, connectionId: edgeId, handleId }]);
  }, []);
  const handleRecordHandleClick = useCallback((nodeId: string, handleId: string) => {
    setRecordingSteps((prev) => [...prev, { order: prev.length, componentId: nodeId, handleId }]);
  }, []);
  const handleRecordUndo = useCallback(() => { setRecordingSteps((prev) => prev.slice(0, -1)); }, []);

  const handleUpdateStepDescription = useCallback((index: number, description: string) => {
    setRecordingSteps((prev) => prev.map((s, i) => (i === index ? { ...s, description } : s)));
  }, []);
  const handleUpdateStepDuration = useCallback((index: number, duration: string) => {
    setRecordingSteps((prev) => prev.map((s, i) => (i === index ? { ...s, duration: duration || undefined } : s)));
  }, []);
  const handleDeleteStep = useCallback((index: number) => {
    setRecordingSteps((prev) => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i })));
  }, []);
  const handleReorderSteps = useCallback((from: number, to: number) => {
    setRecordingSteps((prev) => { const n = [...prev]; const [m] = n.splice(from, 1); n.splice(to, 0, m); return n.map((s, i) => ({ ...s, order: i })); });
  }, []);

  const handleAddTag = useCallback((tag: string) => { setRecordingTags((prev) => prev.includes(tag) ? prev : [...prev, tag]); }, []);
  const handleRemoveTag = useCallback((index: number) => { setRecordingTags((prev) => prev.filter((_, i) => i !== index)); }, []);

  const [copied, setCopied] = useState(false);

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
              onClick={() => { if (!isRecording) setShowFlows(!showFlows); }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                showFlows ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
              } ${isRecording ? "opacity-50 pointer-events-none" : ""}`}
            >
              <GitBranch className="h-3.5 w-3.5" /> Flows
            </button>
            <button
              onClick={handleCopyDrawio}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-transparent hover:border-border transition-all"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Clipboard className="h-3.5 w-3.5" />}
              {copied ? "Copiado!" : "Copy"}
            </button>
            <button
              onClick={handleExport}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-transparent hover:border-border transition-all"
            >
              <Download className="h-3.5 w-3.5" /> Exportar
            </button>
          </div>
        </div>
      </div>
      <div className="flex-1 flex overflow-hidden">
        <RecordingModeProvider value={{
          isRecording,
          recordingSteps,
          onRecordNodeClick: handleRecordNodeClick,
          onRecordEdgeClick: handleRecordEdgeClick,
          onRecordHandleClick: handleRecordHandleClick,
          onRecordUndo: handleRecordUndo,
        }}>
        <ReactFlowProvider>
          <div className="flex-1 flex flex-col relative">
            <Canvas
              activeFlow={activeFlow}
              currentStep={currentStep}
              onOpenDiagram={handleOpenDiagram}
              onDrillUp={navStack.length > 0 ? handleDrillUp : undefined}
              isViewingCoverage={isViewingCoverage}
            />
            {activeFlow && (
              <FlowStepNavigator flow={activeFlow} currentStep={currentStep} onPrev={handlePrev} onNext={handleNext} onExit={handleExit} />
            )}
          </div>
        </ReactFlowProvider>
        </RecordingModeProvider>
        {isRecording && (
          <FlowRecorderPanel
            name={recordingName} onNameChange={setRecordingName}
            description={recordingDescription} onDescriptionChange={setRecordingDescription}
            tags={recordingTags} onAddTag={handleAddTag} onRemoveTag={handleRemoveTag}
            steps={recordingSteps}
            onCancel={handleCancelRecording} onFinalize={handleFinalizeRecording}
            onUpdateStepDescription={handleUpdateStepDescription}
            onUpdateStepDuration={handleUpdateStepDuration}
            onDeleteStep={handleDeleteStep} onReorderSteps={handleReorderSteps}
            isEditing={!!editingFlowId}
          />
        )}
        {showFlows && !activeFlow && !isRecording && (
          <FlowPanel onClose={() => setShowFlows(false)} onPlay={handlePlay} onStartRecording={handleStartRecording} onEditFlow={handleEditFlow} isViewingCoverage={isViewingCoverage} onToggleCoverage={() => setIsViewingCoverage((v) => !v)} />
        )}
      </div>
    </div>
  );
};

export default ModelExplorer;
