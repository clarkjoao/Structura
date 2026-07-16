import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useActiveDiagram,
  useActiveDiagramId,
  useDiagramActions,
  useDiagramStore,
  useFlows,
  useServiceRegistry,
} from "@/features/diagram";
import { getExporterContribution } from "@/features/plugins/io-registry";
import { toDiagramSnapshot } from "@/features/plugins/snapshots";
import {
  buildDiagramExportFiles,
  downloadFile,
  downloadZip,
  exportDrawio,
  exportJson,
  type DiagramExportFormat,
} from "@/lib/export-service";
import { toast } from "sonner";
import { writeDrawioToClipboard } from "@/lib/clipboard-utils";
import { FlowModeProvider } from "@/features/canvas";
import { CollabProvider, CollabStartModal } from "@/features/collaboration";
import { ImportModal } from "@/pages/ImportModal";
import type { CopiedClipboardKind } from "./types";
import { WorkspaceContent } from "./WorkspaceContent";
import { useWorkspaceFlowRecordingFinalize } from "./useWorkspaceFlowRecordingFinalize";

export default function WorkspacePage() {
  const { t } = useTranslation();
  const { id: urlId } = useParams<{ id: string }>();
  const diagram = useActiveDiagram();
  const activeDiagramId = useActiveDiagramId();
  const urlDiagramExists = useDiagramStore((s) => !!(urlId && s.diagrams[urlId]));
  const { openDiagram } = useDiagramActions();
  const flows = useFlows();
  const serviceCatalog = useServiceRegistry();
  const navigate = useNavigate();
  const [showFlows, setShowFlows] = useState(false);
  const [isViewingCoverage, setIsViewingCoverage] = useState(false);
  const [showShortcuts, setShowShortcuts] = useState(false);
  const [navStack, setNavStack] = useState<string[]>([]);
  const [copiedClipboardKind, setCopiedClipboardKind] = useState<CopiedClipboardKind | null>(null);
  const [focusMode, setFocusMode] = useState(false);
  const [showStartModal, setShowStartModal] = useState(false);
  const [collabActive, setCollabActive] = useState(false);
  const [collabUserName, setCollabUserName] = useState("");
  const [collabServerUrl, setCollabServerUrl] = useState("");
  const [importModalOpen, setImportModalOpen] = useState(false);

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

  const flashCopied = useCallback((kind: CopiedClipboardKind) => {
    setCopiedClipboardKind(kind);
    window.setTimeout(() => setCopiedClipboardKind(null), 2000);
  }, []);

  const handleCopyDrawio = useCallback(() => {
    if (!diagram) return;
    void writeDrawioToClipboard(exportDrawio(diagram, serviceCatalog)).then(() => {
      flashCopied("drawio");
    });
  }, [diagram, flashCopied, serviceCatalog]);

  const handleCopyJson = useCallback(async () => {
    if (!diagram) return;
    await navigator.clipboard.writeText(exportJson(diagram));
    flashCopied("json");
  }, [diagram, flashCopied]);

  const handleExportFormats = useCallback(
    async (formats: DiagramExportFormat[], pluginExporterIds: string[]) => {
      if (!diagram) return;
      if (formats.length === 0 && pluginExporterIds.length === 0) return;
      try {
        const { baseName, files } = buildDiagramExportFiles({
          diagram,
          flows,
          serviceCatalog,
          formats,
        });

        // Plugin exporters see a read-only snapshot; their output joins the same
        // download/zip flow as the built-in formats.
        const snapshot = pluginExporterIds.length > 0 ? toDiagramSnapshot(diagram) : null;
        for (const exporterId of pluginExporterIds) {
          const exporter = getExporterContribution(exporterId);
          if (!exporter || !snapshot) continue;
          const content = await exporter.export(snapshot);
          files.push({
            filename: `${baseName}.${exporter.extension}`,
            content,
            mime: exporter.mime,
          });
        }

        if (files.length === 1) {
          const [file] = files;
          downloadFile(file.content, file.filename, file.mime);
          return;
        }

        void downloadZip(
          files.map(({ filename, content }) => ({ filename, content })),
          `${baseName}.zip`,
        );
      } catch (error) {
        toast.error(error instanceof Error ? error.message : t("export.modal.error"));
      }
    },
    [diagram, flows, serviceCatalog, t],
  );

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
        <div className={`flex-1 flex items-center justify-center ${focusMode ? "" : "mt-16"}`}>
          <div className="text-center">
            <p className="text-muted-foreground mb-4">{t("flows.noDiagram")}</p>
            <Link to={backHref} className="text-primary hover:underline text-sm">
              {t("flows.backToDashboard")}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const backHref = diagram.folderId ? `/workspace?f=${diagram.folderId}` : "/workspace";

  return (
    <div className="h-screen flex flex-col">
      <FlowModeProvider onFinalize={onWorkspaceFlowFinalize} onStartRecording={() => {}}>
        <CollabProvider
          enabled={collabActive}
          reserveEphemeralRoomId={showStartModal}
          userName={collabUserName}
          signalingUrl={collabServerUrl}
        >
          <WorkspaceContent
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
            handleExportFormats={handleExportFormats}
            onStartCollab={() => {
              setShowStartModal(true);
              setShowFlows(false);
            }}
            onCollabSessionEnded={() => setCollabActive(false)}
            copiedClipboardKind={copiedClipboardKind}
            flows={flows}
            backHref={backHref}
            focusMode={focusMode}
            onToggleFocusMode={() => setFocusMode((current) => !current)}
          />
          <ImportModal
            open={importModalOpen}
            onOpenChange={setImportModalOpen}
            targetFolderId={diagram.folderId ?? null}
            allowPluginImporters
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
