import { useState, useEffect, useCallback } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Link } from "react-router-dom";
import { ArrowLeft, FileJson, GitBranch } from "lucide-react";
import Navbar from "@/components/Navbar";
import Canvas from "@/components/canvas/Canvas";
import FlowPanel from "@/components/canvas/FlowPanel";
import FlowStepNavigator from "@/components/canvas/FlowStepNavigator";
import { useActiveDiagram } from "@/lib/model-store";
import type { Flow } from "@/lib/model-types";

const ModelExplorer = () => {
  const diagram = useActiveDiagram();
  const [showFlows, setShowFlows] = useState(false);
  const [activeFlow, setActiveFlow] = useState<Flow | null>(null);
  const [currentStep, setCurrentStep] = useState(0);

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
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFlows(!showFlows)}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                showFlows ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
              }`}
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
          <div className="flex-1 relative">
            <Canvas activeFlow={activeFlow} currentStep={currentStep} />
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
        {showFlows && !activeFlow && (
          <FlowPanel onClose={() => setShowFlows(false)} onPlay={handlePlay} />
        )}
      </div>
    </div>
  );
};

export default ModelExplorer;
