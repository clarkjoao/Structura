import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import Navbar from "@/components/Navbar";
import {
  useActiveDiagram,
  useActiveDiagramId,
  useDiagramActions,
  useDiagramStore,
  useFlows,
  useServiceRegistry,
  resolveSceneSnapshot,
  exportFilenameSlug,
} from "@/features/diagram";
import { exportJson, exportDrawio, exportMermaid, downloadZip } from "@/lib/export-service";
import { writeDrawioToClipboard } from "@/lib/clipboard-utils";
import { FlowModeProvider } from "@/features/canvas";
import { CollabProvider, CollabStartModal } from "@/features/collaboration";
import { ModelExplorerContent } from "./ModelExplorerContent";
import { useWorkspaceFlowRecordingFinalize } from "./useWorkspaceFlowRecordingFinalize";

export default function ModelExplorerPage() {
  const { t } = useTranslation();
  const { id: urlId } = useParams<{ id: string }>();
  const diagram = useActiveDiagram();
  const activeDiagramId = useActiveDiagramId();
  const urlDiagramExists = useDiagramStore((s) => !!(urlId && s.diagrams[urlId]));
  const { openDiagram } = useDiagramActions();
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
  const [collabServerUrl, setCollabServerUrl] = useState("");

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

  const handleCopyDrawio = useCallback(() => {
    if (!diagram) return;
    void writeDrawioToClipboard(exportDrawio(diagram, serviceRegistry)).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [diagram, serviceRegistry]);

  const handleCopyJson = useCallback(async () => {
    if (!diagram) return;
    await navigator.clipboard.writeText(exportJson(diagram));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [diagram]);

  const handleExport = useCallback(() => {
    if (!diagram) return;

    const slug = exportFilenameSlug(diagram);
    const sceneSnapshot = resolveSceneSnapshot(diagram, diagram.activeSceneId ?? null);
    const files = [
      { filename: `${slug}.json`, content: exportJson(diagram) },
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

  const handleStartCollab = useCallback((name: string, serverUrl: string) => {
    setCollabUserName(name);
    setCollabServerUrl(serverUrl);
    setCollabActive(true);
    setShowFlows(false);
  }, []);

  const onWorkspaceFlowFinalize = useWorkspaceFlowRecordingFinalize();

  if (!diagram) {
    const backHref = "/workspace";
    return (
      <div className="h-screen flex flex-col">
        <Navbar />
        <div className="flex-1 flex items-center justify-center mt-16">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">{t("flows.noDiagram")}</p>
            <Link to={backHref} className="text-primary hover:underline text-sm">{t("flows.backToDashboard")}</Link>
          </div>
        </div>
      </div>
    );
  }

  const backHref = diagram.folderId
    ? `/workspace?f=${diagram.folderId}`
    : "/workspace";

  return (
    <div className="h-screen flex flex-col">
      <Navbar />
      <FlowModeProvider
        onFinalize={onWorkspaceFlowFinalize}
        onStartRecording={() => {}}
      >
        <CollabProvider
          enabled={collabActive}
          reserveEphemeralRoomId={showStartModal}
          userName={collabUserName}
          signalingUrl={collabServerUrl}
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
            handleCopyJson={handleCopyJson}
            handleExport={handleExport}
            onStartCollab={() => {
              setShowStartModal(true);
              setShowFlows(false);
            }}
            onCollabSessionEnded={() => setCollabActive(false)}
            copied={copied}
            flows={flows}
            backHref={backHref}
          />
          <CollabStartModal
            open={showStartModal}
            onOpenChange={setShowStartModal}
            diagramName={diagram.name}
            onStart={handleStartCollab}
          />
        </CollabProvider>
      </FlowModeProvider>
    </div>
  );
}
