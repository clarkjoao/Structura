import { useTranslation } from "react-i18next";
import { Check } from "lucide-react";
import { getBranchColor } from "../branchColors";

export interface BranchRecordingStripProps {
  conditionStepId: string;
  branchIndex: number;
  branchLabel: string;
  onDone: (conditionStepId: string) => void;
}

export function BranchRecordingStrip({
  conditionStepId,
  branchIndex,
  branchLabel,
  onDone,
}: BranchRecordingStripProps) {
  const { t } = useTranslation();
  return (
    <div
      className="flex items-center justify-between px-3 py-2 border-b border-border shrink-0"
      style={{
        backgroundColor: `${getBranchColor(branchIndex)}15`,
        borderLeftColor: getBranchColor(branchIndex),
        borderLeftWidth: 3,
      }}
    >
      <div className="min-w-0">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider">
          {t("flowScript.recordingBranch")}
        </p>
        <p className="text-sm font-semibold text-foreground truncate">{branchLabel}</p>
      </div>
      <button
        type="button"
        onClick={() => onDone(conditionStepId)}
        className="shrink-0 flex items-center gap-1 rounded-md border border-border bg-card px-2 py-1 text-[11px] font-medium text-foreground hover:bg-surface-hover"
      >
        <Check className="h-3 w-3" /> {t("flowScript.branchDone")}
      </button>
    </div>
  );
}
