import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ReactFlowProvider, useReactFlow, type ReactFlowInstance } from "@xyflow/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CircleHelp,
  FileDown,
  Focus,
  FolderTree,
  GitBranch,
  MoreHorizontal,
  Share2,
} from "lucide-react";
import ShortcutsModal from "@/components/ShortcutsModal";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Canvas, FlowPanel, FlowReadingRail, FlowRecorderPanel } from "@/features/canvas";
import { SaveStatusIndicator } from "@/features/canvas/components/SaveStatusIndicator";
import { FileSystemStatus } from "@/components/FileSystemStatus";
import { EmbedModal, useFlowMode, useInteractionMode } from "@/features/canvas";
import { useActiveDiagram, useStorageMonitor, type Flow } from "@/features/diagram";
import { StorageWarningBanner } from "@/features/canvas/components/StorageWarningBanner";
import { CollabCursors, CollabToolbar, useCollab } from "@/features/collaboration";
import { ExportModal } from "./ExportModal";
import { ShareModal } from "./ShareModal";
import type { WorkspaceContentProps } from "./types";
import { getViewportCenter } from "@/features/canvas/viewport-utils";
import { KEY, keyIs } from "@/lib/keyboard-utils";

/** Stable identity, so the progress memo is not rebuilt on every render. */
const EMPTY_HISTORY: string[] = [];

function ReactFlowInstanceBridge({
  onReady,
}: {
  onReady: (instance: ReactFlowInstance) => void;
}): null {
  const reactFlowInstance = useReactFlow();
  useEffect(() => {
    onReady(reactFlowInstance);
  }, [onReady, reactFlowInstance]);
  return null;
}

export function WorkspaceContent({
  showFlows,
  setShowFlows,
  isViewingCoverage,
  showShortcuts,
  setShowShortcuts,
  navStack,
  handleOpenDiagram,
  handleDrillDownToDiagram,
  handleDrillUp,
  handleCopyDrawio,
  handleCopyJson,
  handleExportFormats,
  onStartCollab,
  onCollabSessionEnded,
  copiedClipboardKind,
  flows,
  backHref,
  focusMode,
  onToggleFocusMode,
}: WorkspaceContentProps) {
  const { t } = useTranslation();
  const {
    session,
    isReady,
    collabUrl,
    peerLimitReached,
    closeSession,
    updateCursor,
    updateSelectedNode,
  } = useCollab();
  const diagram = useActiveDiagram();
  const flowMode = useFlowMode();
  const playbackState = flowMode.mode.kind === "playing" ? flowMode.mode : null;
  const activeFlow = playbackState?.flow ?? null;
  const currentStepId = playbackState?.currentStepId ?? null;
  const recordingState = flowMode.mode.kind === "recording" ? flowMode.mode : null;
  const isEditingFlow = recordingState ? !recordingState.isNewFlow : false;

  const {
    isRecording,
    isPlaying,
    currentStep,
    isCondition,
    canGoBack,
    canGoForward,
    play,
    switchFlow,
    exitPlay,
    goBack,
    goNext,
    chooseBranch,
    stepOver,
    stepOut,
    callStack,
    stepOverTarget,
    stepOutFrameId,
    startRecording,
    cancelRecording,
    finalizeRecording,
    editFlow,
    recordingContext,
    setRecordingContext,
  } = flowMode;

  useStorageMonitor();

  useEffect(() => {
    if (isPlaying) setShowFlows(false);
  }, [isPlaying, setShowFlows]);

  useEffect(() => {
    if (isRecording) setShowFlows(false);
  }, [isRecording, setShowFlows]);

  useEffect(() => {
    if (session) {
      setShowFlows(false);
    }
  }, [session, setShowFlows]);

  useEffect(() => {
    if (flowMode.mode.kind !== "playing") return;
    const handler = (e: KeyboardEvent) => {
      if (keyIs(e, KEY.ESCAPE)) {
        e.preventDefault();
        exitPlay();
        return;
      }
      if (keyIs(e, KEY.ARROW_LEFT)) {
        e.preventDefault();
        goBack();
        return;
      }
      if (keyIs(e, KEY.ARROW_RIGHT)) {
        e.preventDefault();
        if (!isCondition) goNext();
        return;
      }
      /**
       * The debugger's own keys, because the reading borrows its whole shape:
       * F10 steps over a call, Shift+F11 steps out of one. F11 is left to the
       * browser — it is fullscreen, and `Próximo` already has two keys.
       */
      if (keyIs(e, KEY.F10)) {
        e.preventDefault();
        stepOver();
        return;
      }
      if (keyIs(e, KEY.F11) && e.shiftKey) {
        e.preventDefault();
        stepOut();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [flowMode.mode.kind, isCondition, exitPlay, goBack, goNext, stepOver, stepOut]);

  const interaction = useInteractionMode(diagram);
  const canvasInteractionLocked = !interaction.canEditCanvas;
  const compareModeBlocksRecorder = interaction.isCompareMode;
  const flowButtonLocked = canvasInteractionLocked || !interaction.canUseFlow;

  const startRecordingWhenAllowed = useCallback(() => {
    if (!interaction.canUseFlow) {
      toast.warning(t("flows.unavailableDuringCollab"));
      return;
    }
    if (compareModeBlocksRecorder) {
      toast.warning(t("flows.recorderBlockedInCompare"));
      return;
    }
    startRecording();
  }, [interaction.canUseFlow, compareModeBlocksRecorder, startRecording, t]);

  const editFlowWhenAllowed = useCallback(
    (flow: Flow) => {
      if (!interaction.canUseFlow) {
        toast.warning(t("flows.unavailableDuringCollab"));
        return;
      }
      if (compareModeBlocksRecorder) {
        toast.warning(t("flows.recorderBlockedInCompare"));
        return;
      }
      editFlow(flow);
    },
    [interaction.canUseFlow, compareModeBlocksRecorder, editFlow, t],
  );
  const handleEndCollab = useCallback(() => {
    closeSession();
    onCollabSessionEnded?.();
  }, [closeSession, onCollabSessionEnded]);
  const [diagramSidebarOpen, setDiagramSidebarOpen] = useState(false);
  const [embedModalOpen, setEmbedModalOpen] = useState(false);
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [shareModalOpen, setShareModalOpen] = useState(false);
  const lastCursorAtRef = useRef(0);
  const reactFlowInstanceRef = useRef<ReactFlowInstance | null>(null);

  const handleCanvasPointerMove = useCallback(
    (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!session) return;

      const now = performance.now();
      if (now - lastCursorAtRef.current >= 33) {
        const rect = event.currentTarget.getBoundingClientRect();
        updateCursor({
          x: event.clientX - rect.left,
          y: event.clientY - rect.top,
        });
        lastCursorAtRef.current = now;
      }

      const target = event.target as HTMLElement | null;
      const nodeElement = target?.closest?.(".react-flow__node");
      const edgeElement = target?.closest?.(".react-flow__edge");
      const activeId =
        nodeElement?.getAttribute("data-id") ?? edgeElement?.getAttribute("data-id") ?? null;
      updateSelectedNode(activeId);
    },
    [session, updateCursor, updateSelectedNode],
  );

  const handleCanvasPointerLeave = useCallback(() => {
    if (!session) return;
    updateCursor(null);
    updateSelectedNode(null);
  }, [session, updateCursor, updateSelectedNode]);

  return (
    <>
      {!focusMode ? (
        <div className="border-b border-border bg-card shrink-0">
          <div className="container flex items-center justify-between h-12">
            <div className="flex items-center gap-3 text-sm">
              <button
                type="button"
                disabled={canvasInteractionLocked}
                onClick={() => setDiagramSidebarOpen((open) => !open)}
                className={`rounded-md p-1 text-muted-foreground transition-colors ${
                  canvasInteractionLocked ? "opacity-50" : "hover:bg-muted hover:text-foreground"
                }`}
                title={
                  canvasInteractionLocked
                    ? t("diagramNav.unavailableWhileRecordingOrPlayback")
                    : t("diagramNav.openSidebar")
                }
                aria-expanded={diagramSidebarOpen}
                aria-label={t("diagramNav.openSidebar")}
              >
                <FolderTree className="h-4 w-4" />
              </button>
              <Link
                to={backHref}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              {diagram?.domain && <span className="text-muted-foreground">{diagram.domain}</span>}
              <span className="font-medium">{diagram?.name}</span>
              {isRecording && (
                <span
                  className={`text-[10px] font-mono rounded px-1.5 py-0.5 animate-pulse ${
                    isEditingFlow ? "text-amber-400 bg-amber-400/10" : "text-red-400 bg-red-400/10"
                  }`}
                >
                  {isEditingFlow ? t("flows.recordingEdit") : t("flows.recordingRec")}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <SaveStatusIndicator />
              <FileSystemStatus compact hideActions />
              <CollabToolbar
                session={session}
                isReady={isReady}
                collabUrl={collabUrl}
                peerLimitReached={peerLimitReached}
                onStartCollab={interaction.canStartCollab ? onStartCollab : undefined}
                onEndCollab={handleEndCollab}
              />
              <button
                onClick={() => {
                  if (flowButtonLocked) return;
                  setShowFlows(!showFlows);
                }}
                className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                  showFlows
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
                } ${flowButtonLocked ? "opacity-50 pointer-events-none" : ""}`}
                title={!interaction.canUseFlow ? t("flows.unavailableDuringCollab") : undefined}
              >
                <GitBranch className="h-3.5 w-3.5" /> {t("flows.panelTitle")}
              </button>
              <button
                type="button"
                disabled={canvasInteractionLocked}
                onClick={() => setShareModalOpen(true)}
                className={`inline-flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium transition-all ${
                  canvasInteractionLocked
                    ? "opacity-50 pointer-events-none text-muted-foreground border-transparent"
                    : "text-muted-foreground hover:text-foreground border-transparent hover:border-border"
                }`}
                aria-label={t("share.button")}
              >
                <Share2 className="h-3.5 w-3.5" /> {t("share.button")}
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex items-center justify-center rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-transparent hover:border-border transition-all"
                    aria-label={t("canvasToolbar.moreMenuAria")}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-[10rem]">
                  <DropdownMenuItem
                    disabled={canvasInteractionLocked}
                    className="gap-2 text-xs font-medium cursor-pointer"
                    onClick={() => setExportModalOpen(true)}
                  >
                    <FileDown className="h-3.5 w-3.5 shrink-0" size={14} />
                    {t("export.toolbarButton")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="gap-2 text-xs font-medium cursor-pointer"
                    onClick={onToggleFocusMode}
                  >
                    <Focus className="h-3.5 w-3.5 shrink-0" />
                    {t("canvasToolbar.enterFocusMode")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={canvasInteractionLocked}
                    className="gap-2 text-xs font-medium cursor-pointer"
                    onClick={() => setShowShortcuts(true)}
                  >
                    <CircleHelp className="h-3.5 w-3.5 shrink-0" />
                    {t("flows.shortcuts")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      ) : null}
      <div className="flex flex-1 flex-col overflow-hidden min-h-0">
        <StorageWarningBanner />
        <ShortcutsModal open={showShortcuts} onOpenChange={setShowShortcuts} />
        {diagram ? (
          <>
            <EmbedModal open={embedModalOpen} onOpenChange={setEmbedModalOpen} diagram={diagram} />
            <ExportModal
              open={exportModalOpen}
              onOpenChange={setExportModalOpen}
              hasFlows={flows.length > 0}
              onExport={handleExportFormats}
              onCopyDrawio={handleCopyDrawio}
              onCopyJson={handleCopyJson}
              copiedClipboardKind={copiedClipboardKind}
            />
            <ShareModal open={shareModalOpen} onOpenChange={setShareModalOpen} diagram={diagram} />
          </>
        ) : null}
        <div className="flex flex-1 min-h-0 overflow-hidden">
          <ReactFlowProvider>
            {activeFlow && (
              <FlowReadingRail
                flow={activeFlow}
                currentStepId={currentStepId}
                currentStep={currentStep}
                history={playbackState?.history ?? EMPTY_HISTORY}
                seen={playbackState?.seen ?? EMPTY_HISTORY}
                flows={flows}
                onSelectFlow={(flowId) => {
                  const target = flows.find((candidate) => candidate.id === flowId);
                  if (target) switchFlow(target);
                }}
                isCondition={isCondition}
                canGoBack={canGoBack}
                canGoForward={canGoForward}
                onGoNext={goNext}
                onGoBack={goBack}
                onChooseBranch={chooseBranch}
                onExit={exitPlay}
                callStack={callStack}
                canStepOver={stepOverTarget !== null}
                onStepOver={stepOver}
                stepOutFrameId={stepOutFrameId}
                onStepOut={stepOut}
              />
            )}
            <div
              className="flex min-h-0 min-w-0 flex-1 flex-col relative"
              onPointerMove={handleCanvasPointerMove}
              onPointerLeave={handleCanvasPointerLeave}
            >
              <ReactFlowInstanceBridge
                onReady={(instance) => {
                  reactFlowInstanceRef.current = instance;
                }}
              />
              <Canvas
                onOpenDiagram={handleOpenDiagram}
                onDrillDownToDiagram={handleDrillDownToDiagram}
                onDrillUp={navStack.length > 0 ? handleDrillUp : undefined}
                isViewingCoverage={isViewingCoverage}
                isFlowPanelOpen={showFlows}
                diagramSidebarOpen={diagramSidebarOpen}
                onDiagramSidebarOpenChange={setDiagramSidebarOpen}
                focusMode={focusMode}
                onToggleFocusMode={onToggleFocusMode}
                onPlayFlow={(flowId) => {
                  const targetFlow = flows.find((candidate) => candidate.id === flowId);
                  if (targetFlow) play(targetFlow);
                }}
              />
              {session && <CollabCursors peers={session.peers} />}
              {showFlows && !activeFlow && !isRecording && (
                <FlowPanel
                  onClose={() => setShowFlows(false)}
                  onPlay={play}
                  onStartRecording={startRecordingWhenAllowed}
                  onEditFlow={editFlowWhenAllowed}
                  onGetInsertPosition={() => {
                    const instance = reactFlowInstanceRef.current;
                    if (!instance) return { x: 0, y: 0 };
                    return getViewportCenter(instance, !!showFlows);
                  }}
                  panelActionsLocked={compareModeBlocksRecorder || !interaction.canUseFlow}
                  panelActionsLockedTitle={t("diagramNav.unavailableWhileRecordingOrPlayback")}
                />
              )}
            </div>
          </ReactFlowProvider>
          {isRecording && recordingState && (
            <FlowRecorderPanel
              flowId={recordingState.flowId}
              recordingContext={recordingContext}
              setRecordingContext={setRecordingContext}
              onCancel={cancelRecording}
              onFinalize={finalizeRecording}
              isEditing={isEditingFlow}
            />
          )}
        </div>
      </div>
    </>
  );
}
