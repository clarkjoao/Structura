import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ReactFlowProvider } from "@xyflow/react";
import { toast } from "sonner";
import { ArrowLeft, Check, Clipboard, Download, GitBranch, CircleHelp, FolderTree } from "lucide-react";
import ShortcutsModal from "@/components/ShortcutsModal";
import { Canvas, FlowPanel, FlowStepNavigator, FlowRecorderPanel } from "@/features/canvas";
import { useFlowMode, type BranchOwnerInfo, type RecordingContext } from "@/features/canvas/flow";
import { isDiagramCompareMode, useActiveDiagram, type Flow } from "@/features/diagram";
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
  handleExport,
  copied,
  flows,
}: ModelExplorerContentProps) {
  const { t } = useTranslation();
  const diagram = useActiveDiagram();
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

  useEffect(() => {
    if (isPlaying) setShowFlows(false);
  }, [isPlaying, setShowFlows]);

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

  const canvasInteractionLocked = !isIdle || isDiagramCompareMode(diagram);

  const compareModeBlocksRecorder = isDiagramCompareMode(diagram);

  const startRecordingWhenAllowed = useCallback(() => {
    if (compareModeBlocksRecorder) {
      toast.warning(t("flows.recorderBlockedInCompare"));
      return;
    }
    startRecording();
  }, [compareModeBlocksRecorder, startRecording, t]);

  const editFlowWhenAllowed = useCallback(
    (flow: Flow) => {
      if (compareModeBlocksRecorder) {
        toast.warning(t("flows.recorderBlockedInCompare"));
        return;
      }
      editFlow(flow);
    },
    [compareModeBlocksRecorder, editFlow, t],
  );
  const [diagramSidebarOpen, setDiagramSidebarOpen] = useState(false);

  const recordingContext = recordingState?.context ?? TRUNK_CONTEXT;
  const recordingName = recordingState?.name ?? "";
  const recordingDescription = recordingState?.description ?? "";
  const recordingTags = recordingState?.tags ?? [];
  const recordingSteps = recordingState?.steps ?? [];
  const branchOwnership = recordingState?.branchOwnership ?? EMPTY_BRANCH_MAP;

  return (
    <>
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
            <Link to="/workspace" className="text-muted-foreground hover:text-foreground transition-colors">
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
            <button
              onClick={() => { if (!canvasInteractionLocked) setShowFlows(!showFlows); }}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
                showFlows ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground border border-transparent hover:border-border"
              } ${canvasInteractionLocked ? "opacity-50 pointer-events-none" : ""}`}
            >
              <GitBranch className="h-3.5 w-3.5" /> {t("flows.panelTitle")}
            </button>
            <button
              onClick={handleCopyDrawio}
              disabled={canvasInteractionLocked}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-transparent hover:border-border transition-all ${canvasInteractionLocked ? "opacity-50 pointer-events-none" : ""}`}
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Clipboard className="h-3.5 w-3.5" />}
              {copied ? t("flows.copied") : t("flows.copyDrawio")}
            </button>
            <button
              onClick={handleExport}
              disabled={canvasInteractionLocked}
              className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground border border-transparent hover:border-border transition-all ${canvasInteractionLocked ? "opacity-50 pointer-events-none" : ""}`}
            >
              <Download className="h-3.5 w-3.5" /> {t("flows.export")}
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
      <div className="flex-1 flex overflow-hidden">
        <ShortcutsModal open={showShortcuts} onOpenChange={setShowShortcuts} />
        <ReactFlowProvider>
          <div className="flex-1 flex flex-col relative">
            <Canvas
              onOpenDiagram={handleOpenDiagram}
              onDrillDownToDiagram={handleDrillDownToDiagram}
              onDrillUp={navStack.length > 0 ? handleDrillUp : undefined}
              isViewingCoverage={isViewingCoverage}
              isFlowPanelOpen={showFlows}
              diagramSidebarOpen={diagramSidebarOpen}
              onDiagramSidebarOpenChange={setDiagramSidebarOpen}
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
          </div>
        </ReactFlowProvider>
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
            panelActionsLocked={compareModeBlocksRecorder}
            panelActionsLockedTitle={t("diagramNav.unavailableWhileRecordingOrPlayback")}
          />
        )}
      </div>
    </>
  );
}
