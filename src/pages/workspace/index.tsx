import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  useActiveDiagramId,
  useDiagramActions,
  useDiagramStore,
  useFlows,
  useServices,
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
import { useShallow } from "zustand/react/shallow";
import { writeDrawioToClipboard } from "@/lib/clipboard";
import { FlowModeProvider } from "@/features/canvas";
import { CollabProvider, CollabStartModal } from "@/features/collaboration";
import { ImportModal } from "@/pages/ImportModal";
import type { CopiedClipboardKind } from "./types";
import { WorkspaceContent } from "./WorkspaceContent";

function readActiveDiagram() {
  const state = useDiagramStore.getState();
  return state.activeDiagramId ? (state.diagrams[state.activeDiagramId] ?? null) : null;
}

export default function WorkspacePage() {
  const { t } = useTranslation();
  const { id: urlId } = useParams<{ id: string }>();
  // What the page draws, not the whole diagram: that changes on every edit (a peer's too) and
  // re-rendered the page and every modal under it. The export handlers read it when they run.
  const diagram = useDiagramStore(
    useShallow((s) => {
      const active = s.activeDiagramId ? s.diagrams[s.activeDiagramId] : undefined;
      return active ? { name: active.name, folderId: active.folderId } : null;
    }),
  );
  const activeDiagramId = useActiveDiagramId();
  const urlDiagramExists = useDiagramStore((s) => !!(urlId && s.diagrams[urlId]));
  const { openDiagram } = useDiagramActions();
  const flows = useFlows();
  const services = useServices();
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

  // Prevent flashing "diagram not found" during boot sequence.
  // The diagram store is empty on first render while FileSystem boot runs.
  const [isInitialLoadComplete, setIsInitialLoadComplete] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setIsInitialLoadComplete(true), 100);
    return () => clearTimeout(timer);
  }, []);

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

  const handleDrillUpTo = useCallback(
    (index: number) => {
      const prev = navStack[index];
      if (!prev) return;
      setNavStack((s) => s.slice(0, index));
      openDiagram(prev);
      navigate(`/model/${prev}`);
    },
    [navStack, openDiagram, navigate],
  );
  const handleDrillUp = useCallback(
    () => handleDrillUpTo(navStack.length - 1),
    [handleDrillUpTo, navStack.length],
  );

  const flashCopied = useCallback((kind: CopiedClipboardKind) => {
    setCopiedClipboardKind(kind);
    window.setTimeout(() => setCopiedClipboardKind(null), 2000);
  }, []);

  const handleCopyDrawio = useCallback(() => {
    const diagram = readActiveDiagram();
    if (!diagram) return;
    void writeDrawioToClipboard(exportDrawio(diagram, services)).then(() => {
      flashCopied("drawio");
    });
  }, [flashCopied, services]);

  const handleCopyJson = useCallback(async () => {
    const diagram = readActiveDiagram();
    if (!diagram) return;
    // Same payload as the downloaded file, service manifest included — otherwise a diagram
    // pasted from the clipboard would lose its service links on import.
    await navigator.clipboard.writeText(exportJson(diagram, services));
    flashCopied("json");
  }, [flashCopied, services]);

  const handleExportFormats = useCallback(
    async (formats: DiagramExportFormat[], pluginExporterIds: string[]) => {
      const diagram = readActiveDiagram();
      if (!diagram) return;
      if (formats.length === 0 && pluginExporterIds.length === 0) return;
      try {
        const { baseName, files } = buildDiagramExportFiles({
          diagram,
          flows,
          services,
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
    [flows, services, t],
  );

  const handleStartCollab = useCallback((name: string, serverUrl: string) => {
    setCollabUserName(name);
    setCollabServerUrl(serverUrl);
    setCollabActive(true);
    setShowFlows(false);
  }, []);

  // Show loading state while waiting for boot to complete and diagram to load
  if (!diagram && !isInitialLoadComplete) {
    return (
      <div className="h-screen flex flex-col">
        <div className={`flex-1 flex items-center justify-center ${focusMode ? "" : "mt-16"}`}>
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4" />
            <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
          </div>
        </div>
      </div>
    );
  }

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
      <FlowModeProvider onStartRecording={() => {}}>
        <CollabProvider
          enabled={collabActive}
          reserveEphemeralRoomId={showStartModal}
          userName={collabUserName}
          signalingUrl={collabServerUrl}
          onHostSessionEnded={() => setCollabActive(false)}
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
            handleDrillUpTo={handleDrillUpTo}
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
