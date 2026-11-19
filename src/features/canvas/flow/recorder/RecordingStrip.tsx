import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { CornerUpLeft, Undo2 } from "lucide-react";
import { isPlaceholderStep, useFlows } from "@/features/diagram";
import { Button } from "@/components/ui/button";
import { getBranchColor } from "../branchColors";
import type { RecordingContext } from "../flowMode.types";

export interface RecordingStripProps {
  flowId: string;
  context: RecordingContext;
  isEditing?: boolean;
  onUndo: () => void;
  onBackToTrunk: () => void;
  onFinish: () => void;
}

/**
 * Floats over the canvas while a flow is written, because the canvas is where the author is
 * looking: it says a recording is live, where the next click lands, and offers undo and finish
 * without a trip to the panel.
 */
export function RecordingStrip({
  flowId,
  context,
  isEditing,
  onUndo,
  onBackToTrunk,
  onFinish,
}: RecordingStripProps) {
  const { t } = useTranslation();
  const flows = useFlows();
  const flow = flows.find((candidate) => candidate.id === flowId);
  const stepCount = useMemo(
    () => (flow ? Object.values(flow.steps).filter((step) => !isPlaceholderStep(step)).length : 0),
    [flow],
  );
  if (!flow) return null;

  const inBranch = context.mode === "branch-record";
  const branchColor = inBranch ? getBranchColor(context.branchIndex) : undefined;

  return (
    <div
      role="status"
      data-testid="recording-strip"
      className="pointer-events-auto flex items-center gap-3 rounded-[10px] border border-border bg-card py-2 pl-3.5 pr-2 shadow-lg"
    >
      <span
        aria-hidden
        className={`h-2 w-2 shrink-0 animate-pulse rounded-full ${isEditing ? "bg-amber-500" : "bg-red-500"}`}
      />
      <div className="min-w-0">
        <p className="text-[13px] font-semibold text-foreground">
          {t("flowRecorder.strip.recording", { count: stepCount })}
          <span className="font-normal text-muted-foreground"> · </span>
          {inBranch ? (
            <span style={{ color: branchColor }}>
              {t("flowRecorder.strip.inBranch", { label: context.branchLabel })}
            </span>
          ) : (
            <span className="font-normal text-muted-foreground">
              {t("flowRecorder.strip.inTrunk")}
            </span>
          )}
        </p>
        <p className="text-[11px] text-muted-foreground">{t("flowRecorder.strip.hint")}</p>
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {inBranch && (
          <Button variant="ghost" size="sm" className="h-8 gap-1.5" onClick={onBackToTrunk}>
            <CornerUpLeft className="h-3.5 w-3.5" /> {t("flowRecorder.strip.backToTrunk")}
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5"
          onClick={onUndo}
          disabled={stepCount === 0}
        >
          <Undo2 className="h-3.5 w-3.5" /> {t("flowRecorder.strip.undo")}
        </Button>
        <Button size="sm" className="h-8" onClick={onFinish}>
          {t("flowRecorder.finalize")}
        </Button>
      </div>
    </div>
  );
}
