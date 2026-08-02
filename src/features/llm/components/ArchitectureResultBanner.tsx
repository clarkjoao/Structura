/**
 * Shown below the chat input when the last architecture tool call produced a result.
 *
 * - Clean diagnostics → "Commit" button to apply the proposal to the canvas.
 * - Has errors       → error count badge; the assistant message already renders the
 *                       diagnostic list, so this banner only offers the "refine" hint.
 */
import { useTranslation } from "react-i18next";
import { CheckCircle, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ArchitectureToolResult } from "@/features/architecture-gen/execute";

interface ArchitectureResultBannerProps {
  result: ArchitectureToolResult;
  onCommit: () => void;
}

export function ArchitectureResultBanner({ result, onCommit }: ArchitectureResultBannerProps) {
  const { t } = useTranslation();
  const hasErrors = result.diagnostics.length > 0;

  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5",
        hasErrors
          ? "border-amber-500/40 bg-amber-500/10"
          : "border-emerald-500/40 bg-emerald-500/10",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {hasErrors ? (
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
        ) : (
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
        )}
        <p className="min-w-0 text-xs font-medium">
          {hasErrors
            ? t("archGen.banner.errorsFound", { count: result.diagnostics.length })
            : t("archGen.banner.readyToCommit")}
        </p>
      </div>

      <Button
        type="button"
        size="sm"
        variant={hasErrors ? "outline" : "default"}
        className="shrink-0 text-xs"
        onClick={onCommit}
        disabled={hasErrors}
      >
        {hasErrors ? t("archGen.banner.refine") : t("archGen.banner.commit")}
      </Button>
    </div>
  );
}
