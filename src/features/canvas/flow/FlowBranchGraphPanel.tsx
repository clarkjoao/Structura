import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GitBranch, Undo2, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useComponents,
  useConnections,
  buildFlowFromRecordingSnapshot,
  isFlowLinkStep,
} from "@/features/diagram";
import { toast } from "sonner";
import { useFlowMode } from "./FlowModeContext";
import { FlowBranchGraph } from "./FlowBranchGraph";
import { getVerticalRecordingNodeCenter } from "./branchGraphRecordingCoords";
import { useBranchGraphLayout } from "./useBranchGraphLayout";
import { getBranchColor } from "./branchColors";

interface FlowBranchGraphPanelProps {
  selectedStepId: string | null;
  onStepSelect: (stepId: string) => void;
}

type BranchPopoverState = {
  conditionStepId: string;
  anchorX: number;
  anchorY: number;
};

type BifurcatePopoverState = {
  stepId: string;
  anchorX: number;
  anchorY: number;
};

/**
 * Side panel shown alongside FlowRecorderPanel during recording.
 * Renders the in-progress flow as an interactive branch graph so the user can
 * visually understand the structure and navigate/enter branches by clicking.
 */
export function FlowBranchGraphPanel({ selectedStepId, onStepSelect }: FlowBranchGraphPanelProps) {
  const { t } = useTranslation();
  const {
    mode,
    setRecordingContext,
    onEnterBranchRecording,
    onAddBranchLabel,
    onUpdateBranchLabel,
    onConvertStepToCondition,
    onRemoveFlowLink,
  } = useFlowMode();

  const components = useComponents();
  const connections = useConnections();

  const recordingMode = mode.kind === "recording" ? mode : null;

  const previewFlow = useMemo(() => {
    if (!recordingMode) return null;
    return buildFlowFromRecordingSnapshot(
      recordingMode.steps,
      recordingMode.branchOwnership,
      { name: recordingMode.name },
    );
  }, [recordingMode]);

  const layout = useBranchGraphLayout(previewFlow, components, connections);

  const activeRecordingBranchTails = useMemo(() => {
    if (!previewFlow) return new Set<string>();
    const branchTailIds = new Set<string>();
    for (const [id, step] of Object.entries(previewFlow.steps)) {
      if (isFlowLinkStep(step)) continue;
      if (step.type !== "condition" && !step.next) {
        branchTailIds.add(id);
      }
    }
    return branchTailIds;
  }, [previewFlow]);

  const [branchPopover, setBranchPopover] = useState<BranchPopoverState | null>(null);
  const [bifurcatePopover, setBifurcatePopover] = useState<BifurcatePopoverState | null>(null);
  const branchPopoverRef = useRef<HTMLDivElement | null>(null);
  const bifurcatePopoverRef = useRef<HTMLDivElement | null>(null);

  const activeBranchConditionId =
    recordingMode?.context.mode === "branch-record" ? recordingMode.context.conditionStepId : null;
  const activeBranchIndex =
    recordingMode?.context.mode === "branch-record" ? recordingMode.context.branchIndex : null;

  const openBranchPopover = useCallback(
    (conditionStepId: string, anchor: { cx: number; cy: number }) => {
      setBifurcatePopover(null);
      const belowOffset = 14;
      setBranchPopover({
        conditionStepId,
        anchorX: anchor.cx,
        anchorY: anchor.cy + belowOffset,
      });
    },
    [],
  );

  const openBifurcatePopover = useCallback(
    (stepId: string, anchor: { cx: number; cy: number }) => {
      setBranchPopover(null);
      setBifurcateConditionLabel(t("flowRecorder.flowMap.defaultConditionLabel"));
      setBifurcateBranchA(t("flowRecorder.flowMap.defaultBranchA"));
      setBifurcateBranchB(t("flowRecorder.flowMap.defaultBranchB"));
      const belowOffset = 12;
      setBifurcatePopover({
        stepId,
        anchorX: anchor.cx,
        anchorY: anchor.cy + belowOffset,
      });
    },
    [t],
  );

  useEffect(() => {
    if (!branchPopover && !bifurcatePopover) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (branchPopoverRef.current?.contains(target)) return;
      if (bifurcatePopoverRef.current?.contains(target)) return;
      setBranchPopover(null);
      setBifurcatePopover(null);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [branchPopover, bifurcatePopover]);

  const conditionForBranchPopover =
    branchPopover && previewFlow ? previewFlow.steps[branchPopover.conditionStepId] : undefined;

  const [bifurcateConditionLabel, setBifurcateConditionLabel] = useState("");
  const [bifurcateBranchA, setBifurcateBranchA] = useState("");
  const [bifurcateBranchB, setBifurcateBranchB] = useState("");

  const branchPopoverConditionId = branchPopover?.conditionStepId ?? null;

  useEffect(() => {
    if (!branchPopoverConditionId) return;
    const center = getVerticalRecordingNodeCenter(layout, branchPopoverConditionId);
    if (!center) return;
    const belowOffset = 14;
    setBranchPopover((previous) => {
      if (!previous || previous.conditionStepId !== branchPopoverConditionId) return previous;
      return {
        ...previous,
        anchorX: center.cx,
        anchorY: center.cy + belowOffset,
      };
    });
  }, [layout, branchPopoverConditionId]);

  const handleExitBranchRecording = () => {
    if (recordingMode?.context.mode !== "branch-record") return;
    setRecordingContext({
      mode: "branch-select",
      conditionStepId: recordingMode.context.conditionStepId,
    });
  };

  const handleRecordingFlowLinkClick = useCallback(
    (stepId: string) => {
      if (!recordingMode) return;
      if (!window.confirm(t("flowRecorder.flowLink.removeLinkConfirm"))) return;
      onRemoveFlowLink(stepId);
    },
    [recordingMode, onRemoveFlowLink, t],
  );

  if (!recordingMode) return null;

  return (
    <div className="w-[280px] h-full flex flex-col border-l border-border bg-card shrink-0">
      <div className="flex items-center gap-1.5 px-3 py-2.5 border-b border-border shrink-0">
        <GitBranch className="h-3.5 w-3.5 text-muted-foreground" />
        <span className="text-xs font-semibold text-muted-foreground tracking-wide uppercase">
          {t("flowRecorder.flowMap.title")}
        </span>
      </div>

      <div className="flex-1 min-h-0 overflow-y-auto overflow-x-auto p-2">
        <div className="relative inline-block min-w-min">
          <FlowBranchGraph
            layout={layout}
            orientation="vertical"
            activeRecordingBranchTails={activeRecordingBranchTails}
            branchOwnership={recordingMode.branchOwnership}
            activeBranchConditionId={activeBranchConditionId}
            activeBranchIndex={activeBranchIndex}
            selectedStepId={selectedStepId}
            onStepSelect={onStepSelect}
            onConditionClick={openBranchPopover}
            leafBifurcateEnabled
            onLeafBifurcateClick={openBifurcatePopover}
            onRecordingFlowLinkClick={handleRecordingFlowLinkClick}
          />
          {branchPopover &&
            conditionForBranchPopover &&
            conditionForBranchPopover.type === "condition" && (
              <div
                ref={branchPopoverRef}
                className="absolute z-50 w-56 rounded-lg border border-border bg-card p-2 shadow-lg"
                style={{
                  left: branchPopover.anchorX,
                  top: branchPopover.anchorY,
                }}
              >
                <div className="flex items-start justify-between gap-1 border-b border-border pb-1.5 mb-1.5">
                  <p className="text-[11px] font-semibold text-foreground leading-tight pr-1">
                    {conditionForBranchPopover.conditionLabel ?? t("flowRecorder.condition")}
                  </p>
                  <button
                    type="button"
                    onClick={() => setBranchPopover(null)}
                    className="shrink-0 text-muted-foreground hover:text-foreground p-0.5"
                    aria-label={t("flowRecorder.flowMap.closePopover")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {conditionForBranchPopover.branches?.map((branch, branchIndex) => {
                    const color = getBranchColor(branchIndex);
                    return (
                      <div key={branchIndex} className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 rounded-full shrink-0"
                          style={{ backgroundColor: color }}
                        />
                        <input
                          value={branch.label}
                          onChange={(event) =>
                            onUpdateBranchLabel(
                              branchPopover.conditionStepId,
                              branchIndex,
                              event.target.value,
                            )
                          }
                          className="min-w-0 flex-1 rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            onEnterBranchRecording(branchPopover.conditionStepId, branchIndex);
                            setBranchPopover(null);
                          }}
                          className="shrink-0 rounded bg-primary px-1.5 py-0.5 text-[9px] font-semibold text-primary-foreground hover:bg-primary/90"
                        >
                          {t("flowRecorder.flowMap.recordBranch")}
                        </button>
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onAddBranchLabel(branchPopover.conditionStepId, t("flowRecorder.newBranch"))
                  }
                  className="mt-2 w-full rounded border border-dashed border-border py-1 text-[10px] font-medium text-muted-foreground hover:bg-secondary/60"
                >
                  {t("flowRecorder.flowMap.addBranchRow")}
                </button>
              </div>
            )}

          {bifurcatePopover && (
            <div
              ref={bifurcatePopoverRef}
              className="absolute z-50 w-52 rounded-lg border border-border bg-card p-2 shadow-lg space-y-1.5"
              style={{
                left: bifurcatePopover.anchorX,
                top: bifurcatePopover.anchorY,
              }}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">
                  {t("flowRecorder.flowMap.bifurcateTitle")}
                </span>
                <button
                  type="button"
                  onClick={() => setBifurcatePopover(null)}
                  className="text-muted-foreground hover:text-foreground p-0.5"
                  aria-label={t("flowRecorder.flowMap.closePopover")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <label className="block space-y-0.5">
                <span className="text-[9px] text-muted-foreground">
                  {t("flowRecorder.flowMap.conditionFieldLabel")}
                </span>
                <input
                  value={bifurcateConditionLabel}
                  onChange={(event) => setBifurcateConditionLabel(event.target.value)}
                  className="w-full rounded border border-border bg-secondary px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </label>
              <label className="block space-y-0.5">
                <span className="text-[9px] text-muted-foreground">
                  {t("flowRecorder.flowMap.branchLabelA")}
                </span>
                <input
                  value={bifurcateBranchA}
                  onChange={(event) => setBifurcateBranchA(event.target.value)}
                  className="w-full rounded border border-border bg-secondary px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </label>
              <label className="block space-y-0.5">
                <span className="text-[9px] text-muted-foreground">
                  {t("flowRecorder.flowMap.branchLabelB")}
                </span>
                <input
                  value={bifurcateBranchB}
                  onChange={(event) => setBifurcateBranchB(event.target.value)}
                  className="w-full rounded border border-border bg-secondary px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </label>
              <button
                type="button"
                onClick={() => {
                  const stepIndex = recordingMode.steps.findIndex(
                    (step) => step.id === bifurcatePopover.stepId,
                  );
                  if (stepIndex < 0) return;
                  const branchLabelFirst = bifurcateBranchA.trim();
                  const branchLabelSecond = bifurcateBranchB.trim();
                  if (!branchLabelFirst || !branchLabelSecond) {
                    toast.warning(t("flowRecorder.minBranchesWarning"));
                    return;
                  }
                  onConvertStepToCondition(
                    stepIndex,
                    bifurcateConditionLabel.trim() || t("flowRecorder.flowMap.defaultConditionLabel"),
                    [branchLabelFirst, branchLabelSecond],
                  );
                  setBifurcatePopover(null);
                }}
                className="w-full rounded-md bg-primary py-1.5 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90"
              >
                {t("flowRecorder.flowMap.createBifurcation")}
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="px-3 py-2 border-t border-border shrink-0 flex items-center gap-2 min-h-[40px]">
        {recordingMode.context.mode === "trunk" && (
          <span className="text-[10px] font-semibold text-primary">{t("flowRecorder.flowMap.trunk")}</span>
        )}
        {recordingMode.context.mode === "branch-select" && (
          <span className="text-[10px] font-medium text-amber-400">
            {t("flowRecorder.flowMap.selectBranchHint")}
          </span>
        )}
        {recordingMode.context.mode === "branch-record" && (
          <>
            <span
              className="inline-flex items-center max-w-[160px] rounded-full px-2 py-0.5 text-[10px] font-semibold text-primary-foreground truncate"
              style={{ backgroundColor: getBranchColor(recordingMode.context.branchIndex) }}
              title={recordingMode.context.branchLabel}
            >
              {recordingMode.context.branchLabel}
            </span>
            <button
              type="button"
              onClick={handleExitBranchRecording}
              className="ml-auto inline-flex items-center gap-1 rounded-md border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground hover:bg-secondary hover:text-foreground"
              title={t("flowRecorder.flowMap.exitBranchTitle")}
            >
              <Undo2 className="h-3 w-3" aria-hidden />
              {t("flowRecorder.flowMap.exitBranchTitle")}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default FlowBranchGraphPanel;
