import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { ReactFlowProvider } from "@xyflow/react";
import { toast } from "sonner";
import { ArrowLeft, Check, Clipboard, Download, GitBranch, CircleHelp, FolderTree } from "lucide-react";
import ShortcutsModal from "@/components/ShortcutsModal";
import { Canvas, FlowPanel, FlowStepNavigator, FlowRecorderPanel } from "@/features/canvas";
import { useRecordingMode } from "@/features/canvas/flow/RecordingModeContext";
import { useFlowPlayback } from "@/features/canvas/flow/FlowPlaybackContext";
import { isDiagramCompareMode, useActiveDiagram, type Flow } from "@/features/diagram";
import type { ModelExplorerContentProps } from "./types";

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
  const {
    isRecording,
    editingFlowId,
    startRecording,
    cancelRecording,
    finalizeRecording,
    editFlow,
    ...recordingProps
  } = useRecordingMode();
  const { activeFlow, currentStepId, currentStep, isPlaying, isCondition, canGoBack, canGoForward, play, exit, goBack, goNext, chooseBranch } = useFlowPlayback();

  const canvasInteractionLocked = isRecording || isPlaying || isDiagramCompareMode(diagram);
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

  return (
    <>
      <div className="border-b border-border bg-card shrink-0 mt-16">
        <div className="container flex items-center justify-between h-12">
          <div className="flex items-center gap-3 text-sm">
            <button
              type="button"
              disabled={canvasInteractionLocked}
              onClick={() => setDiagramSidebarOpen((v) => !v)}
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
                const flow = flows.find((f) => f.id === flowId);
                if (flow) play(flow);
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
                onExit={exit}
              />
            )}
          </div>
        </ReactFlowProvider>
        {isRecording && (
          <FlowRecorderPanel
            recordingContext={recordingProps.recordingContext}
            setRecordingContext={recordingProps.setRecordingContext}
            name={recordingProps.recordingName}
            onNameChange={recordingProps.setRecordingName}
            description={recordingProps.recordingDescription}
            onDescriptionChange={recordingProps.setRecordingDescription}
            tags={recordingProps.recordingTags}
            onAddTag={recordingProps.onAddTag}
            onRemoveTag={recordingProps.onRemoveTag}
            steps={recordingProps.recordingStepsForPanel}
            recordingSteps={recordingProps.recordingSteps}
            branchOwnership={recordingProps.branchOwnership}
            onCancel={cancelRecording}
            onFinalize={finalizeRecording}
            onUpdateStepDescription={recordingProps.onUpdateStepDescription}
            onUpdateStepDuration={recordingProps.onUpdateStepDuration}
            onUpdateStepPayload={recordingProps.onUpdateStepPayload}
            onUpdateStepPayloadDirection={recordingProps.onUpdateStepPayloadDirection}
            onUpdateStepIsAsync={recordingProps.onUpdateStepIsAsync}
            onDeleteStep={recordingProps.onDeleteStep}
            onReorderSteps={recordingProps.onReorderSteps}
            onConvertStepToCondition={recordingProps.onConvertStepToCondition}
            onUpdateConditionLabel={recordingProps.onUpdateConditionLabel}
            onAddBranchLabel={recordingProps.onAddBranchLabel}
            onRemoveBranchLabel={recordingProps.onRemoveBranchLabel}
            onUpdateBranchLabel={recordingProps.onUpdateBranchLabel}
            onAddConditionStep={recordingProps.onAddConditionStep}
            onEnterBranchRecording={recordingProps.onEnterBranchRecording}
            onOpenBranchSelect={recordingProps.onOpenBranchSelect}
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
            onToggleCoverage={() => setIsViewingCoverage((v) => !v)}
            panelActionsLocked={compareModeBlocksRecorder}
            panelActionsLockedTitle={t("diagramNav.unavailableWhileRecordingOrPlayback")}
          />
        )}
      </div>
    </>
  );
}
