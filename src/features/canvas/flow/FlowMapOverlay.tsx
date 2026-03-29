import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { Check, ChevronDown, GitBranch, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  useComponents,
  useConnections,
  buildFlowFromRecordingSnapshot,
  isConditionStep,
  isFlowLinkStep,
} from "@/features/diagram";
import type { FlowStep } from "@/features/diagram";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { useFlowMode } from "./FlowModeContext";
import { FlowBranchGraph } from "./FlowBranchGraph";
import { getVerticalRecordingNodeCenter } from "./branchGraphRecordingCoords";
import { useBranchGraphLayout, type GraphNode } from "./useBranchGraphLayout";
import { getBranchColor } from "./branchColors";

const MAX_BIFURCATE_BRANCH_LABELS = 6;

function clampOverlayPosition(
  left: number,
  top: number,
  width: number,
  height: number,
): { x: number; y: number } {
  const maxX = Math.max(0, window.innerWidth - width);
  const maxY = Math.max(0, window.innerHeight - height);
  return {
    x: Math.min(Math.max(0, left), maxX),
    y: Math.min(Math.max(0, top), maxY),
  };
}

export interface FlowMapOverlayProps {
  selectedStepId?: string | null;
  onStepSelect: (stepId: string | null) => void;
}

/**
 * Draggable floating branch map during flow recording — branch navigation and
 * condition editing live here instead of the recorder side panel.
 */
export function FlowMapOverlay({ selectedStepId = null, onStepSelect }: FlowMapOverlayProps) {
  const { t } = useTranslation();
  const overlayRef = useRef<HTMLDivElement>(null);
  const posRef = useRef({ x: 24, y: 120 });
  const draggingRef = useRef(false);
  const [pos, setPos] = useState<{ x: number; y: number }>(() => ({
    x: 24,
    y: typeof window !== "undefined" ? Math.max(0, window.innerHeight - 96 - 280) : 120,
  }));

  const {
    mode,
    setRecordingContext,
    onEnterBranchRecording,
    onAddBranchLabel,
    onUpdateBranchLabel,
    onRemoveBranchLabel,
    onConvertStepToCondition,
    onRemoveFlowLink,
    onSetConditionMerge,
  } = useFlowMode();

  const recordingMode = mode.kind === "recording" ? mode : null;
  const components = useComponents();
  const connections = useConnections();

  const previewFlow = useMemo(() => {
    if (!recordingMode) return null;
    return buildFlowFromRecordingSnapshot(
      recordingMode.steps,
      recordingMode.branchOwnership,
      { name: recordingMode.name },
    );
  }, [recordingMode]);

  const layout = useBranchGraphLayout(previewFlow, components, connections);

  const conditionMergeEdges = useMemo(() => {
    if (!previewFlow) return undefined;
    const edges: { conditionStepId: string; mergeStepId: string }[] = [];
    for (const step of Object.values(previewFlow.steps)) {
      if (isConditionStep(step) && step.next) {
        edges.push({ conditionStepId: step.id, mergeStepId: step.next });
      }
    }
    return edges.length > 0 ? edges : undefined;
  }, [previewFlow]);

  const conditionSteps = useMemo(
    () => (recordingMode ? recordingMode.steps.filter(isConditionStep) : []),
    [recordingMode],
  );

  const activeRecordingBranchTails = useMemo(() => {
    if (!previewFlow) return new Set<string>();
    const branchTailIds = new Set<string>();
    for (const [id, step] of Object.entries(previewFlow.steps)) {
      if (isConditionStep(step) || isFlowLinkStep(step)) continue;
      if (!step.next) branchTailIds.add(id);
    }
    return branchTailIds;
  }, [previewFlow]);

  const activeBranchConditionId =
    recordingMode?.context.mode === "branch-record" ? recordingMode.context.conditionStepId : null;
  const activeBranchIndex =
    recordingMode?.context.mode === "branch-record" ? recordingMode.context.branchIndex : null;

  const [contextDropdownOpen, setContextDropdownOpen] = useState(false);
  const contextTriggerRef = useRef<HTMLButtonElement>(null);
  const contextDropdownRef = useRef<HTMLDivElement>(null);

  const [conditionPopoverStepId, setConditionPopoverStepId] = useState<string | null>(null);
  const [bifurcatePopover, setBifurcatePopover] = useState<{
    stepId: string;
    anchorX: number;
    anchorY: number;
  } | null>(null);
  const [bifurcateConditionLabel, setBifurcateConditionLabel] = useState("");
  const [bifurcateBranchLabels, setBifurcateBranchLabels] = useState<string[]>(["", ""]);
  const [mergeConditionSelection, setMergeConditionSelection] = useState<Set<string>>(() => new Set());

  const branchPopoverRef = useRef<HTMLDivElement>(null);
  const bifurcatePopoverRef = useRef<HTMLDivElement>(null);

  const branchSelectConditionId =
    recordingMode?.context.mode === "branch-select" ? recordingMode.context.conditionStepId : null;

  useEffect(() => {
    if (!bifurcatePopover || !recordingMode) {
      setMergeConditionSelection(new Set());
      return;
    }
    const clickedStepId = bifurcatePopover.stepId;
    setMergeConditionSelection(
      new Set(
        recordingMode.steps
          .filter(isConditionStep)
          .filter((cond) => cond.next === clickedStepId)
          .map((cond) => cond.id),
      ),
    );
  }, [bifurcatePopover, recordingMode]);

  useEffect(() => {
    if (branchSelectConditionId === null) return;
    setContextDropdownOpen(true);
  }, [branchSelectConditionId]);

  useEffect(() => {
    if (!contextDropdownOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setContextDropdownOpen(false);
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [contextDropdownOpen]);

  const closeContextDropdown = useCallback(() => {
    setContextDropdownOpen(false);
  }, []);

  const conditionPopoverAnchor = useMemo(() => {
    if (!conditionPopoverStepId) return null;
    const center = getVerticalRecordingNodeCenter(layout, conditionPopoverStepId);
    if (!center) return null;
    return { x: center.cx, y: center.cy + 14 };
  }, [conditionPopoverStepId, layout]);

  const conditionStepForPopover =
    conditionPopoverStepId && previewFlow
      ? previewFlow.steps[conditionPopoverStepId]
      : undefined;

  useEffect(() => {
    if (!conditionPopoverStepId && !bifurcatePopover && !contextDropdownOpen) return;
    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (branchPopoverRef.current?.contains(target)) return;
      if (bifurcatePopoverRef.current?.contains(target)) return;
      if (contextTriggerRef.current?.contains(target)) return;
      if (contextDropdownRef.current?.contains(target)) return;
      setConditionPopoverStepId(null);
      setBifurcatePopover(null);
      setContextDropdownOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [conditionPopoverStepId, bifurcatePopover, contextDropdownOpen]);

  const handleRecordingMapClick = useCallback(
    (stepId: string, step: FlowStep, _graphNode: GraphNode) => {
      if (isConditionStep(step)) {
        setBifurcatePopover(null);
        setConditionPopoverStepId(stepId);
        return;
      }
      onStepSelect(stepId);
      if (!recordingMode) return;
      const recordingContextMode = recordingMode.context.mode;
      if (recordingContextMode !== "trunk" && recordingContextMode !== "branch-record") return;
      const center = getVerticalRecordingNodeCenter(layout, stepId);
      if (!center) return;
      setConditionPopoverStepId(null);
      setBifurcateConditionLabel(t("flowMap.defaultConditionLabel"));
      setBifurcateBranchLabels([t("flowMap.defaultBranchA"), t("flowMap.defaultBranchB")]);
      setBifurcatePopover({
        stepId,
        anchorX: center.cx,
        anchorY: center.cy + 12,
      });
    },
    [layout, onStepSelect, recordingMode, t],
  );

  const handleRecordingFlowLinkClick = useCallback(
    (stepId: string) => {
      if (!recordingMode) return;
      if (!window.confirm(t("flowRecorder.flowLink.removeLinkConfirm"))) return;
      onRemoveFlowLink(stepId);
    },
    [recordingMode, onRemoveFlowLink, t],
  );

  useLayoutEffect(() => {
    const el = overlayRef.current;
    if (!el || typeof window === "undefined") return;
    const height = el.getBoundingClientRect().height;
    const initialY = Math.max(0, window.innerHeight - 96 - height);
    const initialX = 24;
    const clamped = clampOverlayPosition(initialX, initialY, el.offsetWidth, el.offsetHeight);
    posRef.current = clamped;
    el.style.position = "fixed";
    el.style.left = `${clamped.x}px`;
    el.style.top = `${clamped.y}px`;
    el.style.bottom = "auto";
    setPos(clamped);
  }, []);

  const handleHeaderMouseDown = (event: ReactMouseEvent) => {
    event.preventDefault();
    const el = overlayRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const offsetX = event.clientX - rect.left;
    const offsetY = event.clientY - rect.top;
    draggingRef.current = true;

    const onMove = (ev: MouseEvent) => {
      if (!draggingRef.current) return;
      const node = overlayRef.current;
      if (!node) return;
      const w = node.offsetWidth;
      const h = node.offsetHeight;
      const next = clampOverlayPosition(ev.clientX - offsetX, ev.clientY - offsetY, w, h);
      node.style.left = `${next.x}px`;
      node.style.top = `${next.y}px`;
      node.style.bottom = "auto";
      posRef.current = next;
    };

    const onUp = () => {
      draggingRef.current = false;
      setPos({ ...posRef.current });
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  useEffect(() => {
    const onResize = () => {
      const el = overlayRef.current;
      if (!el) return;
      const clamped = clampOverlayPosition(posRef.current.x, posRef.current.y, el.offsetWidth, el.offsetHeight);
      posRef.current = clamped;
      el.style.left = `${clamped.x}px`;
      el.style.top = `${clamped.y}px`;
      setPos(clamped);
    };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  if (!recordingMode) return null;

  const contextMode = recordingMode.context.mode;

  const renderContextTriggerLabel = () => {
    if (contextMode === "trunk") {
      return (
        <span className="truncate text-[10px] font-semibold text-primary-foreground">
          {t("flowMap.trunk")}
        </span>
      );
    }
    if (contextMode === "branch-select") {
      return (
        <span className="truncate text-[10px] font-semibold text-amber-950">{t("flowMap.selectBranch")}</span>
      );
    }
    return (
      <span className="truncate text-[10px] font-semibold text-primary-foreground">
        {recordingMode.context.branchLabel}
      </span>
    );
  };

  const renderContextTriggerClass = () => {
    if (contextMode === "trunk") {
      return "bg-primary text-primary-foreground";
    }
    if (contextMode === "branch-select") {
      return "bg-amber-500/90 text-amber-950";
    }
    return "text-primary-foreground";
  };

  const renderContextTriggerStyle = (): CSSProperties | undefined => {
    if (contextMode === "branch-record") {
      return { backgroundColor: getBranchColor(recordingMode.context.branchIndex) };
    }
    return undefined;
  };

  return (
    <div
      ref={overlayRef}
      className="z-[60] flex flex-col rounded-lg border border-border bg-card shadow-lg"
      style={{
        position: "fixed",
        left: pos.x,
        top: pos.y,
        width: 280,
        maxHeight: "min(60vh + 120px, 90vh)",
      }}
    >
      <div className="relative z-20 shrink-0 border-b border-border">
        <div className="flex items-center gap-2 px-3 py-2">
          <div
            role="presentation"
            onMouseDown={handleHeaderMouseDown}
            className="flex min-w-0 flex-1 cursor-grab select-none items-center gap-2 active:cursor-grabbing"
          >
            <GitBranch className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
            <span className="truncate text-xs font-semibold tracking-wide text-muted-foreground">
              {t("flowMap.title")}
            </span>
          </div>
          <button
            ref={contextTriggerRef}
            type="button"
            onMouseDown={(mouseEvent) => mouseEvent.stopPropagation()}
            onClick={() => setContextDropdownOpen((open) => !open)}
            aria-haspopup="listbox"
            aria-expanded={contextDropdownOpen}
            className={cn(
              "ml-auto flex min-w-0 max-w-[150px] shrink-0 items-center gap-0.5 rounded-full py-0.5 pl-2 pr-1 text-left",
              renderContextTriggerClass(),
            )}
            style={renderContextTriggerStyle()}
          >
            <span className="min-w-0 flex-1">{renderContextTriggerLabel()}</span>
            <ChevronDown
              className={cn("h-3 w-3 shrink-0 opacity-80 transition-transform", contextDropdownOpen && "rotate-180")}
              aria-hidden
            />
          </button>
        </div>

        {contextDropdownOpen && (
          <div
            ref={contextDropdownRef}
            className="absolute left-0 right-0 top-full z-50 max-h-64 overflow-y-auto border-b border-border bg-card shadow-md"
            role="listbox"
          >
            <div className="border-b border-border px-3 py-1.5 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
              {t("flowMap.recordingIn")}
            </div>
            <button
              type="button"
              role="option"
              aria-selected={contextMode === "trunk"}
              onClick={() => {
                setRecordingContext({ mode: "trunk" });
                closeContextDropdown();
              }}
              className="flex w-full items-center gap-2 border-b border-border px-3 py-2 text-left text-[11px] hover:bg-secondary/80"
            >
              <span className="h-2 w-2 shrink-0 rounded-full bg-primary" aria-hidden />
              <span className="min-w-0 flex-1 font-medium text-foreground">{t("flowMap.trunk")}</span>
              {contextMode === "trunk" ? <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden /> : null}
            </button>

            {conditionSteps.length > 0 ? (
              <div className="border-b border-border px-3 py-1 text-[9px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("flowMap.conditionSteps")}
              </div>
            ) : null}

            {conditionSteps.map((conditionStep) => (
              <div key={conditionStep.id} className="border-b border-border last:border-b-0">
                <div className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold text-foreground">
                  <span aria-hidden>◇</span>
                  <span className="min-w-0 truncate">
                    {conditionStep.conditionLabel ?? t("flowRecorder.condition")}
                  </span>
                </div>
                {(conditionStep.branches ?? []).map((branch, branchIndex) => {
                  const branchColor = getBranchColor(branchIndex);
                  const isActiveBranch =
                    contextMode === "branch-record" &&
                    recordingMode.context.conditionStepId === conditionStep.id &&
                    recordingMode.context.branchIndex === branchIndex;
                  return (
                    <button
                      key={branchIndex}
                      type="button"
                      role="option"
                      aria-selected={isActiveBranch}
                      onClick={() => {
                        onEnterBranchRecording(conditionStep.id, branchIndex);
                        closeContextDropdown();
                      }}
                      className="flex w-full items-center gap-2 py-1.5 pl-6 pr-3 text-left text-[11px] hover:bg-secondary/80"
                    >
                      <span
                        className="h-2 w-2 shrink-0 rounded-full border-2 border-solid"
                        style={{ borderColor: branchColor, backgroundColor: `${branchColor}33` }}
                        aria-hidden
                      />
                      <span className="min-w-0 flex-1 truncate text-foreground">{branch.label}</span>
                      {isActiveBranch ? (
                        <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
                      ) : null}
                    </button>
                  );
                })}
              </div>
            ))}

            {contextMode === "branch-record" ? (
              <button
                type="button"
                onClick={() => {
                  const recordingContext = recordingMode.context;
                  if (recordingContext.mode !== "branch-record") return;
                  onAddBranchLabel(recordingContext.conditionStepId, t("flowMap.newBranch"));
                }}
                className="flex w-full items-center gap-2 border-t border-border px-3 py-2 text-left text-[11px] font-medium text-muted-foreground hover:bg-secondary/60"
              >
                <span aria-hidden>+</span>
                <span>{t("flowMap.addBranch")}</span>
              </button>
            ) : null}
          </div>
        )}
      </div>

      <div className="max-h-[60vh] min-h-0 overflow-x-auto overflow-y-auto p-2">
        <div className="relative inline-block min-w-min">
          <FlowBranchGraph
            layout={layout}
            orientation="vertical"
            activeRecordingBranchTails={activeRecordingBranchTails}
            branchOwnership={recordingMode.branchOwnership}
            activeBranchConditionId={activeBranchConditionId}
            activeBranchIndex={activeBranchIndex}
            selectedStepId={selectedStepId}
            onRecordingMapClick={handleRecordingMapClick}
            onRecordingFlowLinkClick={handleRecordingFlowLinkClick}
            conditionMergeEdges={conditionMergeEdges}
            onRecordingMapBackgroundClick={() => onStepSelect(null)}
          />
          {conditionPopoverStepId &&
            conditionStepForPopover &&
            isConditionStep(conditionStepForPopover) &&
            conditionPopoverAnchor && (
              <div
                ref={branchPopoverRef}
                className="absolute z-50 w-56 rounded-lg border border-border bg-card p-2 shadow-lg"
                style={{
                  left: conditionPopoverAnchor.x,
                  top: conditionPopoverAnchor.y,
                }}
              >
                <div className="mb-1.5 flex items-start justify-between gap-1 border-b border-border pb-1.5">
                  <p className="flex items-center gap-1 pr-1 text-[11px] font-semibold leading-tight text-foreground">
                    <span aria-hidden>◇</span>
                    {conditionStepForPopover.conditionLabel ?? t("flowRecorder.condition")}
                  </p>
                  <button
                    type="button"
                    onClick={() => setConditionPopoverStepId(null)}
                    className="shrink-0 p-0.5 text-muted-foreground hover:text-foreground"
                    aria-label={t("flowMap.conditionPopoverClose")}
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="max-h-40 space-y-1 overflow-y-auto">
                  {conditionStepForPopover.branches?.map((branch, branchIndex) => {
                    const branchColor = getBranchColor(branchIndex);
                    return (
                      <div key={branchIndex} className="flex items-center gap-1.5">
                        <span
                          className="h-2 w-2 shrink-0 rounded-full"
                          style={{ backgroundColor: branchColor }}
                        />
                        <BranchLabelField
                          label={branch.label}
                          onCommit={(value) =>
                            onUpdateBranchLabel(conditionPopoverStepId, branchIndex, value)
                          }
                        />
                        {(conditionStepForPopover.branches?.length ?? 0) > 2 ? (
                          <button
                            type="button"
                            onClick={() => onRemoveBranchLabel(conditionPopoverStepId, branchIndex)}
                            className="shrink-0 p-0.5 text-muted-foreground hover:text-destructive"
                            aria-label={t("common.delete")}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
                <button
                  type="button"
                  onClick={() => onAddBranchLabel(conditionPopoverStepId, t("flowMap.newBranch"))}
                  className="mt-2 w-full rounded border border-dashed border-border py-1 text-[10px] font-medium text-muted-foreground hover:bg-secondary/60"
                >
                  {t("flowMap.addBranch")}
                </button>
              </div>
            )}

          {bifurcatePopover && (
            <div
              ref={bifurcatePopoverRef}
              className="absolute z-50 w-52 space-y-1.5 rounded-lg border border-border bg-card p-2 shadow-lg"
              style={{
                left: bifurcatePopover.anchorX,
                top: bifurcatePopover.anchorY,
              }}
            >
              <div className="flex items-center justify-between gap-1">
                <span className="pr-1 text-[10px] font-semibold leading-tight text-foreground">
                  {t("flowMap.forkHere")}
                </span>
                <button
                  type="button"
                  onClick={() => setBifurcatePopover(null)}
                  className="p-0.5 text-muted-foreground hover:text-foreground"
                  aria-label={t("flowMap.conditionPopoverClose")}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              <p className="text-[9px] font-medium text-muted-foreground">{t("flowMap.newCondition")}</p>
              <label className="block space-y-0.5">
                <span className="text-[9px] text-muted-foreground">{t("flowMap.conditionLabel")}</span>
                <input
                  value={bifurcateConditionLabel}
                  onChange={(changeEvent) => setBifurcateConditionLabel(changeEvent.target.value)}
                  className="w-full rounded border border-border bg-secondary px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                />
              </label>
              <div className="space-y-1">
                {bifurcateBranchLabels.map((branchLabelValue, branchLabelIndex) => (
                  <div key={branchLabelIndex} className="flex items-center gap-1">
                    <label className="block min-w-0 flex-1 space-y-0.5">
                      <input
                        value={branchLabelValue}
                        onChange={(changeEvent) => {
                          const nextLabels = [...bifurcateBranchLabels];
                          nextLabels[branchLabelIndex] = changeEvent.target.value;
                          setBifurcateBranchLabels(nextLabels);
                        }}
                        placeholder={t("flowMap.newBranch")}
                        aria-label={t("flowMap.branchLabelSlot", { n: branchLabelIndex + 1 })}
                        className="w-full rounded border border-border bg-secondary px-2 py-1 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
                      />
                    </label>
                    {bifurcateBranchLabels.length > 2 ? (
                      <button
                        type="button"
                        onClick={() => {
                          setBifurcateBranchLabels(
                            bifurcateBranchLabels.filter((_, indexRemove) => indexRemove !== branchLabelIndex),
                          );
                        }}
                        className="shrink-0 p-0.5 text-muted-foreground hover:text-destructive"
                        aria-label={t("common.delete")}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
              {bifurcateBranchLabels.length < MAX_BIFURCATE_BRANCH_LABELS ? (
                <button
                  type="button"
                  onClick={() =>
                    setBifurcateBranchLabels([...bifurcateBranchLabels, ""])
                  }
                  className="w-full rounded border border-dashed border-border py-1 text-[10px] font-medium text-muted-foreground hover:bg-secondary/60"
                >
                  + {t("flowMap.addBranch")}
                </button>
              ) : null}
              {bifurcatePopover &&
              recordingMode &&
              conditionSteps.length > 0 &&
              !recordingMode.branchOwnership.has(bifurcatePopover.stepId) ? (
                <div className="space-y-1.5 border-t border-border pt-2">
                  <p className="text-[10px] font-semibold text-foreground">{t("flowMap.mergePoint")}</p>
                  <p className="text-[9px] text-muted-foreground leading-snug">{t("flowMap.mergeConvergesHere")}</p>
                  <div className="max-h-28 space-y-1 overflow-y-auto">
                    {conditionSteps.map((cond) => (
                      <label
                        key={cond.id}
                        className="flex cursor-pointer items-start gap-2 rounded border border-transparent px-0.5 py-0.5 hover:bg-secondary/50"
                      >
                        <input
                          type="checkbox"
                          checked={mergeConditionSelection.has(cond.id)}
                          onChange={() => {
                            setMergeConditionSelection((previous) => {
                              const next = new Set(previous);
                              if (next.has(cond.id)) next.delete(cond.id);
                              else next.add(cond.id);
                              return next;
                            });
                          }}
                          className="mt-0.5 rounded"
                        />
                        <span className="text-[10px] leading-snug text-foreground">
                          <span aria-hidden>◇</span>{" "}
                          {cond.conditionLabel?.trim()
                            ? cond.conditionLabel
                            : t("flowMap.unnamedCondition")}
                        </span>
                      </label>
                    ))}
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        if (!bifurcatePopover || !recordingMode) return;
                        const clickedStepId = bifurcatePopover.stepId;
                        for (const cond of conditionSteps) {
                          const shouldMerge = mergeConditionSelection.has(cond.id);
                          const pointsHere = cond.next === clickedStepId;
                          if (shouldMerge && !pointsHere) {
                            onSetConditionMerge(cond.id, clickedStepId);
                          }
                          if (!shouldMerge && pointsHere) {
                            onSetConditionMerge(cond.id, null);
                          }
                        }
                      }}
                      className="flex-1 rounded-md bg-primary py-1.5 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90"
                    >
                      {t("flowMap.mergeSet")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (!bifurcatePopover || !recordingMode) return;
                        const clickedStepId = bifurcatePopover.stepId;
                        for (const cond of conditionSteps) {
                          if (cond.next === clickedStepId) {
                            onSetConditionMerge(cond.id, null);
                          }
                        }
                        setMergeConditionSelection(new Set());
                      }}
                      className="flex-1 rounded border border-border py-1.5 text-[10px] font-medium text-muted-foreground hover:bg-secondary"
                    >
                      {t("flowMap.mergeClear")}
                    </button>
                  </div>
                </div>
              ) : null}
              <div className="flex gap-1.5 pt-1">
                <button
                  type="button"
                  onClick={() => setBifurcatePopover(null)}
                  className="flex-1 rounded border border-border py-1.5 text-[10px] font-medium text-muted-foreground hover:bg-secondary"
                >
                  {t("flowMap.cancel")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const stepIndex = recordingMode.steps.findIndex(
                      (recordingStep) => recordingStep.id === bifurcatePopover.stepId,
                    );
                    if (stepIndex < 0) return;
                    const branchLabelsCommitted = bifurcateBranchLabels
                      .map((labelValue) => labelValue.trim())
                      .filter(Boolean);
                    if (branchLabelsCommitted.length < 2) {
                      toast.warning(t("flowRecorder.minBranchesWarning"));
                      return;
                    }
                    onConvertStepToCondition(
                      stepIndex,
                      bifurcateConditionLabel.trim() || t("flowMap.defaultConditionLabel"),
                      branchLabelsCommitted,
                    );
                    setBifurcatePopover(null);
                  }}
                  className="flex-1 rounded-md bg-primary py-1.5 text-[10px] font-semibold text-primary-foreground hover:bg-primary/90"
                >
                  {t("flowMap.create")}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface BranchLabelFieldProps {
  label: string;
  onCommit: (value: string) => void;
}

function BranchLabelField({ label, onCommit }: BranchLabelFieldProps) {
  const [draft, setDraft] = useState(label);
  useEffect(() => {
    setDraft(label);
  }, [label]);

  const commit = useCallback(() => {
    onCommit(draft);
  }, [draft, onCommit]);

  return (
    <input
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
          (event.target as HTMLInputElement).blur();
        }
      }}
      className="min-w-0 flex-1 rounded border border-border bg-secondary px-1.5 py-0.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-ring"
    />
  );
}

export default FlowMapOverlay;
