import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { RecordingModeStateProvider } from "@/features/canvas/flow/RecordingModeContext";
import { FlowPlaybackProvider } from "@/features/canvas/flow/FlowPlaybackContext";
import { useFlowPlaybackState } from "@/features/canvas/flow/useFlowPlayback";
import {
  useActiveDiagram,
  useActiveDiagramId,
  useDiagramActions,
  useFlows,
  stepsToMermaid,
  useServiceRegistry,
  buildFlowFromRecordingSnapshot,
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
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [navStack, setNavStack] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);

  const playback = useFlowPlaybackState(activeFlow);

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

  const handlePlay = useCallback((flow: Flow) => {
    setActiveFlow(flow);
    setShowFlows(false);
  }, []);

  // Start playback when activeFlow changes
  useEffect(() => {
    if (activeFlow) playback.start();
  }, [activeFlow]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleExit = useCallback(() => {
    playback.exit();
    setActiveFlow(null);
  }, [playback]);

  const handleFinalizeRecording = useCallback(
    (data: import("@/features/canvas/flow/RecordingModeContext").RecordingFinalizeData) => {
      if (!diagram) return;

      const tempFlow = buildFlowFromRecordingSnapshot(data.steps, data.branchOwnership, {
        id: "temp",
        name: data.name,
        diagramId: diagram.id,
      });
      const stepsRecord = tempFlow.steps;
      const entryStepId = data.entryStepId ?? data.steps[0]?.id ?? tempFlow.entryStepId;
      const mermaid = stepsToMermaid(
        { ...tempFlow, entryStepId },
        diagram.snapshot.components,
        diagram.snapshot.connections,
      );

      const desc = data.description || undefined;
      const flowTags = data.tags.length ? data.tags : undefined;
      if (data.editingFlowId) {
        updateFlow(data.editingFlowId, {
          name: data.name || t("flows.unnamed"),
          mermaid,
          steps: stepsRecord,
          description: desc,
          tags: flowTags,
          entryStepId,
        });
      } else {
        const flow = addFlow(diagram.id, data.name || t("flows.unnamed"), mermaid, stepsRecord);
        if (desc || flowTags || entryStepId) {
          updateFlow(flow.id, { description: desc, tags: flowTags, entryStepId });
        }
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
      if (e.key === "ArrowLeft") { e.preventDefault(); playback.goBack(); return; }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (!playback.isCondition) playback.goNext();
        return;
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [activeFlow, handleExit, playback]);

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
    currentStepId: playback.currentStepId,
    currentStep: playback.currentStep,
    isPlaying: !!activeFlow && playback.currentStepId !== null,
    isCondition: playback.isCondition,
    canGoBack: playback.canGoBack,
    canGoForward: playback.canGoForward,
    history: playback.history,
    play: handlePlay,
    exit: handleExit,
    goBack: playback.goBack,
    goNext: playback.goNext,
    chooseBranch: playback.chooseBranch,
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
}
