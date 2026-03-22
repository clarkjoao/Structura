import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { RecordingModeStateProvider } from "@/features/canvas/flow/RecordingModeContext";
import { FlowPlaybackProvider } from "@/features/canvas/flow/FlowPlaybackContext";
import {
  useActiveDiagram,
  useActiveDiagramId,
  useDiagramActions,
  useFlows,
  stepsToMermaid,
  useServiceRegistry,
  resolveSceneSnapshot,
  exportFilenameSlug,
} from "@/features/diagram";
import type { Flow, FlowStep } from "@/features/diagram";
import { exportJSON, exportDrawio, exportMermaid, downloadFile } from "@/lib/export-service";
import { writeDrawioToClipboard } from "@/lib/clipboard-utils";
import { ModelExplorerContent } from "./ModelExplorerContent";

export default function ModelExplorerPage() {
  const { t } = useTranslation();
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
      setNavStack([]);
      openDiagram(id);
      navigate(`/model/${id}`);
    },
    [openDiagram, navigate],
  );

  const handleDrillDownToDiagram = useCallback(
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
    (data: { name: string; description: string; tags: string[]; steps: FlowStep[]; editingFlowId: string | null }) => {
      if (!diagram) return;
      const r = resolveSceneSnapshot(diagram, diagram.activeSceneId ?? null);
      const mermaid = stepsToMermaid(data.steps, r.components, r.connections);
      const desc = data.description || undefined;
      const flowTags = data.tags.length ? data.tags : undefined;
      if (data.editingFlowId) {
        updateFlow(data.editingFlowId, { name: data.name || t("flows.unnamed"), mermaid, steps: data.steps, description: desc, tags: flowTags });
      } else {
        const flow = addFlow(diagram.id, data.name || t("flows.unnamed"), mermaid, data.steps);
        if (desc || flowTags) updateFlow(flow.id, { description: desc, tags: flowTags });
      }
    },
    [diagram, addFlow, updateFlow, t],
  );

  const handleCopyDrawio = useCallback(() => {
    if (!diagram) return;
    void writeDrawioToClipboard(exportDrawio(diagram, serviceRegistry)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [diagram, serviceRegistry]);

  const handleExport = useCallback(() => {
    if (!diagram) return;
    const slug = exportFilenameSlug(diagram);
    const r = resolveSceneSnapshot(diagram, diagram.activeSceneId ?? null);
    downloadFile(exportJSON(diagram), `${slug}.json`, "application/json");
    downloadFile(exportDrawio(diagram, serviceRegistry), `${slug}.drawio`, "application/xml");
    if (flows.length > 0) {
      downloadFile(
        exportMermaid(flows, r.components, r.connections),
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
            <p className="text-muted-foreground mb-4">{t("flows.noDiagram")}</p>
            <Link to="/workspace" className="text-primary hover:underline text-sm">{t("flows.backToDashboard")}</Link>
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
            handleDrillDownToDiagram={handleDrillDownToDiagram}
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
}
