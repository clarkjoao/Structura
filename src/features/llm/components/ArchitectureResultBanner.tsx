/**
 * Shown below the chat input when the last architecture tool call produced a result.
 *
 * Three states:
 * - Clean (no errors, no geometry issues) → "Commit" button to apply.
 * - Has IR errors → error count badge with "Refine" hint; commit is blocked.
 * - Has only geometry issues → committable; show "Apply" as primary, "Refine" as secondary.
 */
import { useTranslation } from "react-i18next";
import { CheckCircle, AlertTriangle, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ArchitectureToolResult } from "@/features/architecture-gen/execute";

interface ArchitectureResultBannerProps {
  result: ArchitectureToolResult;
  onCommit: () => void;
}

export function ArchitectureResultBanner({ result, onCommit }: ArchitectureResultBannerProps) {
  const { t } = useTranslation();

  // Three states based on error classification:
  // 1. No IR errors and no geometry issues → clean, ready to commit.
  // 2. Has IR errors → blocked, needs refinement.
  // 3. Only geometry issues → committable, user can apply or refine.
  const hasIrErrors = result.irErrors > 0;
  const hasGeometryIssues = result.geometryIssues > 0;
  const isClean = !hasIrErrors && !hasGeometryIssues;

  if (isClean) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <CheckCircle className="h-4 w-4 shrink-0 text-emerald-500" />
          <p className="min-w-0 text-xs font-medium">{t("archGen.banner.readyToCommit")}</p>
        </div>
        <Button type="button" size="sm" variant="default" className="shrink-0 text-xs" onClick={onCommit}>
          {t("archGen.banner.commit")}
        </Button>
      </div>
    );
  }

  if (hasIrErrors) {
    return (
      <div className="flex items-center justify-between gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2.5">
        <div className="flex min-w-0 items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-500" />
          <p className="min-w-0 text-xs font-medium">
            {t("archGen.banner.errorsFound", { count: result.diagnostics.length })}
          </p>
        </div>
        <Button type="button" size="sm" variant="outline" className="shrink-0 text-xs" disabled>
          {t("archGen.banner.refine")}
        </Button>
      </div>
    );
  }

  // Only geometry issues — committable. Apply is primary, refine is optional.
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2.5">
      <div className="flex min-w-0 items-center gap-2">
        <Info className="h-4 w-4 shrink-0 text-blue-500" />
        <p className="min-w-0 text-xs font-medium">
          {t("archGen.banner.geometryObservations", { count: result.geometryIssues })}
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="text-xs"
          onClick={onCommit}
          disabled={hasIrErrors}
        >
          {t("archGen.banner.refine")}
        </Button>
        <Button type="button" size="sm" variant="default" className="text-xs" onClick={onCommit}>
          {t("archGen.banner.apply")}
        </Button>
      </div>
    </div>
  );
}
