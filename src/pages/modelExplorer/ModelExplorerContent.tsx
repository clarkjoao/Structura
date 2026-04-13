import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ReactFlowProvider } from "@xyflow/react";
import { toast } from "sonner";
import {
  ArrowLeft,
  CircleHelp,
  FileDown,
  Focus,
  FolderTree,
  GitBranch,
  Share2,
  Upload,
} from "lucide-react";
import { cn } from "@/lib/utils";
import ShortcutsModal from "@/components/ShortcutsModal";
import { Canvas, FlowPanel, FlowStepNavigator, FlowRecorderPanel } from "@/features/canvas";
import { SaveStatusIndicator } from "@/features/canvas/components/SaveStatusIndicator";
import {
  EmbedModal,
  useFlowMode,
  useInteractionMode,
  type BranchOwnerInfo,
  type RecordingContext,
} from "@/features/canvas";
import { useActiveDiagram, useStorageMonitor, type Flow } from "@/features/diagram";
import { StorageWarningBanner } from "@/features/canvas/components/StorageWarningBanner";
import { CollabCursors, CollabToolbar, useCollab } from "@/features/collaboration";
import { useJourneyPlayer } from "@/features/journeys";
import { ExportModal } from "./ExportModal";
import { ShareModal } from "./ShareModal";
import type { ModelExplorerContentProps } from "./types";

const TRUNK_CONTEXT: RecordingContext = { mode: "trunk" };
const EMPTY_BRANCH_MAP = new Map<string, BranchOwnerInfo>();

export function ModelExplorerContent({
  showFlows,
  setShowFlows,
  isViewingCoverage,
  setIsViewingCoverage,
  showShortcuts,
  setShowShortcuts,
  navStack,
  handleOpenDiagram,
  handleDrillDownToDiagram,
  handleDrillUp,
  handleCopyDrawio,
  handleCopyJson,
  handleCopyStructurizr,
  handleExportFormats,
  onStartCollab,
  onCollabSessionEnded,
  copiedClipboardKind,
  flows,
  backHref,
  focusMode,
  onToggleFocusMode,
}: ModelExplorerContentProps) {
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
  const journeyPlayer = useJourneyPlayer();
  const flowMode = useFlowMode();
  const playbackState = flowMode.mode.kind === "playing" ? flowMode.mode : null;
  const activeFlow = playbackState?.flow ?? null;
  const currentStepId = playbackState?.currentStepId ?? null;
  const recordingState = flowMode.mode.kind === "recording" ? flowMode.mode : null;
  const editingFlowId = recordingState?.editingFlowId ?? null;

  const {
    isRecording,
    isIdle,
    isPlaying,
    currentStep,
    isCondition,
    canGoBack,
    canGoForward,
    play,
    exitPlay,
    goBack,
    goNext,
    chooseBranch,
    startRecording,
    cancelRecording,
    finalizeRecording,
    editFlow,
    recordingStepsForPanel,
    setRecordingContext,
    setRecordingName,
    setRecordingDescription,
    onAddTag,
    onRemoveTag,
    onUpdateStepDescription,
    onUpdateStepDuration,
    onUpdateStepPayload,
    onUpdateStepPayloadDirection,
    onUpdateStepIsAsync,
    onDeleteStep,
    onReorderSteps,
    onConvertStepToCondition,
    onUpdateConditionLabel,
    onAddBranchLabel,
    onRemoveBranchLabel,
    onUpdateBranchLabel,
    onAddConditionStep,
    onEnterBranchRecording,
    onOpenBranchSelect,
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
      if (e.key === "Escape") {
        e.preventDefault();
        exitPlay();
        return;
      }
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
        return;
      }
      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (!isCondition) goNext();
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [flowMode.mode.kind, isCondition, exitPlay, goBack, goNext]);

  const interaction = useInteractionMode(diagram);
  const canvasInteractionLocked = !interaction.canEditCanvas;
  const compareModeBlocksRecorder = interaction.isCompareMode;
  const flowButtonLocked = canvasInteractionLocked || !interaction.canUseFlow;
  const journeyPlaybackActive = journeyPlayer.mode.kind !== "idle";

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
        nodeElement?.getAttribute("data-id") ??
        edgeElement?.getAttribute("data-id") ??
        null;
      updateSelectedNode(activeId);
    },
    [session, updateCursor, updateSelectedNode],
  );

  const handleCanvasPointerLeave = useCallback(() => {
    if (!session) return;
    updateCursor(null);
    updateSelectedNode(null);
  }, [session, updateCursor, updateSelectedNode]);

  const recordingContext = recordingState?.context ?? TRUNK_CONTEXT;
  const recordingName = recordingState?.name ?? "";
  const recordingDescription = recordingState?.description ?? "";
  const recordingTags = recordingState?.tags ?? [];
  const recordingSteps = recordingState?.steps ?? [];
  const branchOwnership = recordingState?.branchOwnership ?? EMPTY_BRANCH_MAP;

  return (
    <>
      {!focusMode ? (
        <div className="border-b border-border bg-card shrink-0 mt-16">
        <div className="container flex items-center justify-between h-12">
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              disabled={canvasInteractionLocked}
              onClick={() => setDiagramSidebarOpen((open) => !open)}
              className={`rounded-md p-1 text-muted-foreground transition-colors ${
                canvasInteractionLocked
                  ? "opacity-50"
                  : "hover:bg-muted hover:text-foreground"
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
            <Link to={backHref} className="text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-4 w-4" />
            </Link>
            {diagram?.domain && <span className="text-muted-foreground">{diagram.domain}</span>}
            <span className="font-medium">{diagram?.name}</span>
            {activeFlow && (
              <span className="text-[10px] font-mono text-primary bg-primary/10 rounded px-1.5 py-0.5">
                ▶ {activeFlow.name}{activeFlow.description ? ` · "${activeFlow.description}"` : ""}
              </span>
            )}
            {isRecording && (
              <span className={`text-[10px] font-mono rounded px-1.5 py-0.5 animate-pulse ${
                editingFlowId ? "text-amber-400 bg-amber-400/10" : "text-red-400 bg-red-400/10"
              }`}>
                {editingFlowId ? t("flows.recordingEdit") : t("flows.recordingRec")}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <SaveStatusIndicator />
            <CollabToolbar
              session={session}
              isReady={isReady}
              collabUrl={collabUrl}
              peerLimitReached={peerLimitReached}
              onStartCollab={interaction.canStartCollab ? onStartCollab : undefined}
              onEndCollab={handleEndCollab}
            />
            <button
              onClick={() => { if (flowButtonLocked) return; setShowFlows(!showFlows); }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                showFlows ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
              } ${flowButtonLocked ? "opacity-50 pointer-events-none" : ""}`}
              title={!interaction.canUseFlow ? t("flows.unavailableDuringCollab") : undefined}
            >
              <GitBranch className="h-3.5 w-3.5" /> {t("flows.panelTitle")}
            </button>
            <button
              type="button"
              disabled={canvasInteractionLocked}
              onClick={() => setShareModalOpen(true)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                "text-muted-foreground hover:text-foreground",
                "border border-transparent hover:border-border",
                "bg-transparent transition-colors",
                canvasInteractionLocked ? "opacity-50 pointer-events-none" : "",
              )}
            >
              <Share2 size={15} />
              {t("share.button")}
            </button>
            <button
              type="button"
              disabled={canvasInteractionLocked}
              onClick={() => setExportModalOpen(true)}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium",
                "text-muted-foreground hover:text-foreground",
                "border border-transparent hover:border-border",
                "bg-transparent transition-colors",
                canvasInteractionLocked ? "opacity-50 pointer-events-none" : "",
              )}
            >
              <FileDown size={15} />
              {t("export.hub.toolbarButton")}
            </button>
            <button
              onClick={onToggleFocusMode}
              className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-transparent hover:border-border transition-all"
              title={t("canvasToolbar.enterFocusMode")}
            >
              <Focus className="h-3.5 w-3.5" /> {t("canvasToolbar.enterFocusMode")}
            </button>
            <button
              onClick={() => setShowShortcuts(true)}
              disabled={canvasInteractionLocked}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-transparent hover:border-border transition-all ${canvasInteractionLocked ? "opacity-50 pointer-events-none" : ""}`}
              aria-label={t("flows.shortcutsAria")}
              title={t("flows.shortcuts")}
            >
              <CircleHelp className="h-3.5 w-3.5" /> {t("flows.shortcuts")}
            </button>
          </div>
        </div>
        </div>
      ) : null}
      <div className="flex-1 flex flex-col overflow-hidden min-h-0">
        <StorageWarningBanner />
        <div className="flex flex-1 min-h-0 overflow-hidden">
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
              onCopyStructurizr={handleCopyStructurizr}
              onEmbedRequest={() => setEmbedModalOpen(true)}
              copiedClipboardKind={copiedClipboardKind}
            />
            <ShareModal open={shareModalOpen} onOpenChange={setShareModalOpen} diagram={diagram} />
          </>
        ) : null}
        <ReactFlowProvider>
          <div
            className="flex-1 flex flex-col relative"
            onPointerMove={handleCanvasPointerMove}
            onPointerLeave={handleCanvasPointerLeave}
          >
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
            {activeFlow && (
              <FlowStepNavigator
                flow={activeFlow}
                currentStepId={currentStepId}
                currentStep={currentStep}
                isCondition={isCondition}
                canGoBack={canGoBack}
                canGoForward={canGoForward}
                onGoNext={goNext}
                onGoBack={goBack}
                onChooseBranch={chooseBranch}
                onExit={exitPlay}
              />
            )}
            {session && <CollabCursors peers={session.peers} />}
          </div>
        </ReactFlowProvider>
        </div>
        {isRecording && (
          <FlowRecorderPanel
            recordingContext={recordingContext}
            setRecordingContext={setRecordingContext}
            name={recordingName}
            onNameChange={setRecordingName}
            description={recordingDescription}
            onDescriptionChange={setRecordingDescription}
            tags={recordingTags}
            onAddTag={onAddTag}
            onRemoveTag={onRemoveTag}
            steps={recordingStepsForPanel}
            recordingSteps={recordingSteps}
            branchOwnership={branchOwnership}
            onCancel={cancelRecording}
            onFinalize={finalizeRecording}
            onUpdateStepDescription={onUpdateStepDescription}
            onUpdateStepDuration={onUpdateStepDuration}
            onUpdateStepPayload={onUpdateStepPayload}
            onUpdateStepPayloadDirection={onUpdateStepPayloadDirection}
            onUpdateStepIsAsync={onUpdateStepIsAsync}
            onDeleteStep={onDeleteStep}
            onReorderSteps={onReorderSteps}
            onConvertStepToCondition={onConvertStepToCondition}
            onUpdateConditionLabel={onUpdateConditionLabel}
            onAddBranchLabel={onAddBranchLabel}
            onRemoveBranchLabel={onRemoveBranchLabel}
            onUpdateBranchLabel={onUpdateBranchLabel}
            onAddConditionStep={onAddConditionStep}
            onEnterBranchRecording={onEnterBranchRecording}
            onOpenBranchSelect={onOpenBranchSelect}
            isEditing={!!editingFlowId}
          />
        )}
        {showFlows && !activeFlow && !isRecording && (
          <FlowPanel
            onClose={() => setShowFlows(false)}
            onPlay={play}
            onStartRecording={startRecordingWhenAllowed}
            onEditFlow={editFlowWhenAllowed}
            isViewingCoverage={isViewingCoverage}
            onToggleCoverage={() => setIsViewingCoverage((viewing) => !viewing)}
            panelActionsLocked={
              compareModeBlocksRecorder ||
              !interaction.canUseFlow ||
              journeyPlaybackActive
            }
            panelActionsLockedTitle={t("diagramNav.unavailableWhileRecordingOrPlayback")}
          />
        )}
      </div>
    </>
  );
}
