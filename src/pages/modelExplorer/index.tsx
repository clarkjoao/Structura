import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import { FlowModeProvider, type RecordingFinalizeData } from "@/features/canvas/flow";
import {
  useActiveDiagram,
  useActiveDiagramId,
  useDiagramActions,
  useDiagramStore,
  useFlows,
  useServiceRegistry,
  buildFlowFromRecordingSnapshot,
  resolveSceneSnapshot,
  exportFilenameSlug,
  stepsToMermaid,
} from "@/features/diagram";
import { exportJSON, exportDrawio, exportMermaid, downloadZip } from "@/lib/export-service";
import { writeDrawioToClipboard } from "@/lib/clipboard-utils";
import { CollabProvider, CollabStartModal } from "@/features/collaboration";
import { ModelExplorerContent } from "./ModelExplorerContent";

export default function ModelExplorerPage() {
  const { t } = useTranslation();
  const { id: urlId } = useParams<{ id: string }>();
  const diagram = useActiveDiagram();
  const activeDiagramId = useActiveDiagramId();
  const urlDiagramExists = useDiagramStore((s) => !!(urlId && s.diagrams[urlId]));
  const { openDiagram, addFlow, updateFlow } = useDiagramActions();
  const flows = useFlows();
  const serviceRegistry = useServiceRegistry();
  const navigate = useNavigate();
  const [showFlows, setShowFlows] = useState(false);
  const [isViewingCoverage, setIsViewingCoverage] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [navStack, setNavStack] = useState<string[]>([]);
  const [copied, setCopied] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [collabActive, setCollabActive] = useState(false);
  const [collabUserName, setCollabUserName] = useState("");
  const [collabSignalingUrl, setCollabSignalingUrl] = useState("");

  // Sync URL :id → store.activeDiagramId (handles page refresh / direct link)
  useEffect(() => {
    if (urlId && urlDiagramExists && activeDiagramId !== urlId) {
      openDiagram(urlId);
    }
  }, [urlId, urlDiagramExists, activeDiagramId, openDiagram]);

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

  const handleFinalizeRecording = useCallback(
    (data: RecordingFinalizeData) => {
      if (!diagram) return;

      const tempFlow = buildFlowFromRecordingSnapshot(data.steps, data.branchOwnership, {
        id: "temp",
        name: data.name,
        diagramId: diagram.id,
      });
      const stepsRecord = tempFlow.steps;
      const entryStepId = data.entryStepId ?? data.steps[0]?.id ?? tempFlow.entryStepId;
      const r = resolveSceneSnapshot(diagram, diagram.activeSceneId ?? null);
      const mermaid = stepsToMermaid(
        { ...tempFlow, entryStepId },
        r.components,
        r.connections,
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

    const slug = exportFilenameSlug(diagram);
    const sceneSnapshot = resolveSceneSnapshot(diagram, diagram.activeSceneId ?? null);
    const files = [
      { filename: `${slug}.json`, content: exportJSON(diagram) },
      { filename: `${slug}.drawio`, content: exportDrawio(diagram, serviceRegistry) },
    ];

    if (flows.length > 0) {
      files.push({
        filename: `${slug}-flows.md`,
        content: exportMermaid(flows, sceneSnapshot.components, sceneSnapshot.connections),
      });
    }

    void downloadZip(files, `${slug}.zip`);
  }, [diagram, flows, serviceRegistry]);

  const handleStartCollab = useCallback((name: string, signalingUrl: string) => {
    setCollabUserName(name);
    setCollabSignalingUrl(signalingUrl);
    setCollabActive(true);
  }, []);

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

  return (
    <div className="h-screen flex flex-col">
      <Navbar />
      <FlowModeProvider
        onFinalize={handleFinalizeRecording}
        onStartRecording={() => setShowFlows(false)}
      >
        <CollabProvider
          enabled={collabActive}
          userName={collabUserName}
          signalingUrl={collabSignalingUrl}
        >
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
            onStartCollab={() => setShowStartModal(true)}
            copied={copied}
            flows={flows}
          />
          <CollabStartModal
            open={showStartModal}
            onOpenChange={setShowStartModal}
            diagramId={diagram.id}
            diagramName={diagram.name}
            onStart={handleStartCollab}
          />
        </CollabProvider>
      </FlowModeProvider>
    </div>
  );
}
