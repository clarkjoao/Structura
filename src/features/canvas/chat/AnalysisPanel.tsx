import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Info,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import type { AnalysisFinding, AnalysisResponse, AnalysisSeverity } from "@/features/llm";
import { cn } from "@/lib/utils";

const SEVERITY_ICONS: Record<
  AnalysisSeverity,
  typeof XCircle
> = {
  critical: XCircle,
  high: AlertCircle,
  medium: AlertTriangle,
  low: Info,
  info: Info,
};

const SEVERITY_STYLES: Record<
  AnalysisSeverity,
  { color: string; bg: string }
> = {
  critical: { color: "text-destructive", bg: "bg-destructive/10" },
  high: { color: "text-orange-500", bg: "bg-orange-500/10" },
  medium: { color: "text-yellow-500", bg: "bg-yellow-500/10" },
  low: { color: "text-blue-400", bg: "bg-blue-400/10" },
  info: { color: "text-muted-foreground", bg: "bg-muted/40" },
};

function FindingCard({ finding }: { finding: AnalysisFinding }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(
    finding.severity === "critical" || finding.severity === "high",
  );
  const styles = SEVERITY_STYLES[finding.severity] ?? SEVERITY_STYLES.info;
  const Icon = SEVERITY_ICONS[finding.severity] ?? Info;
  const severityLabel = t(`llmChat.analysis.severity.${finding.severity}`);

  return (
    <div className={cn("rounded-lg border border-border", styles.bg)}>
      <button
        type="button"
        className="flex w-full items-start gap-2 p-3 text-left"
        onClick={() => setOpen((previous) => !previous)}
      >
        <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", styles.color)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className={cn("text-[10px] font-semibold uppercase tracking-wider", styles.color)}>
              {severityLabel}
            </span>
            <span className="text-[10px] text-muted-foreground">{finding.category}</span>
          </div>
          <p className="mt-0.5 text-sm font-medium text-foreground">{finding.title}</p>
        </div>
        {open ? (
          <ChevronUp className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronDown className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open ? (
        <div className="space-y-2 border-t border-border/50 px-3 pb-3 pt-2">
          <p className="text-xs leading-relaxed text-muted-foreground">{finding.detail}</p>
          <div className="rounded-md bg-card/60 px-2.5 py-2">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("llmChat.analysis.recommendation")}
            </p>
            <p className="text-xs leading-relaxed text-foreground">{finding.recommendation}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}

interface AnalysisPanelProps {
  analysis: AnalysisResponse;
  onDismiss: () => void;
}

export function AnalysisPanel({ analysis, onDismiss }: AnalysisPanelProps) {
  const { t } = useTranslation();

  const severityOrder: Record<AnalysisSeverity, number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };
  const sorted = [...analysis.findings].sort(
    (findingA, findingB) =>
      (severityOrder[findingA.severity] ?? 5) - (severityOrder[findingB.severity] ?? 5),
  );

  const criticalCount = sorted.filter((finding) => finding.severity === "critical").length;
  const highCount = sorted.filter((finding) => finding.severity === "high").length;

  return (
    <div className="flex flex-col gap-3 border-b border-border bg-muted/20 p-3">
      <div className="rounded-lg border border-border bg-card/50 p-3">
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {t("llmChat.analysis.summary")}
        </p>
        <p className="text-sm leading-relaxed text-foreground">{analysis.summary}</p>

        {criticalCount > 0 || highCount > 0 ? (
          <div className="mt-2 flex flex-wrap gap-3">
            {criticalCount > 0 ? (
              <span className="flex items-center gap-1 text-[11px] font-medium text-destructive">
                <XCircle className="h-3 w-3" />
                {t("llmChat.analysis.criticalCount", { count: criticalCount })}
              </span>
            ) : null}
            {highCount > 0 ? (
              <span className="flex items-center gap-1 text-[11px] font-medium text-orange-500">
                <AlertCircle className="h-3 w-3" />
                {t("llmChat.analysis.highCount", { count: highCount })}
              </span>
            ) : null}
          </div>
        ) : null}
      </div>

      {sorted.length > 0 ? (
        <div className="space-y-2">
          <p className="px-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("llmChat.analysis.findings")} ({sorted.length})
          </p>
          {sorted.map((finding, index) => (
            <FindingCard key={`${finding.title}-${index}`} finding={finding} />
          ))}
        </div>
      ) : null}

      {analysis.strengths.length > 0 ? (
        <div className="rounded-lg border border-border bg-green-500/5 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-green-600 dark:text-green-400">
            {t("llmChat.analysis.strengths")}
          </p>
          <ul className="space-y-1">
            {analysis.strengths.map((line, index) => (
              <li key={index} className="flex gap-2 text-xs text-foreground">
                <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
                {line}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {analysis.nextSteps.length > 0 ? (
        <div className="rounded-lg border border-border bg-card/50 p-3">
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("llmChat.analysis.nextSteps")}
          </p>
          <ol className="space-y-1.5">
            {analysis.nextSteps.map((step, index) => (
              <li key={index} className="flex gap-2 text-xs text-foreground">
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                  {index + 1}
                </span>
                {step}
              </li>
            ))}
          </ol>
        </div>
      ) : null}

      <button
        type="button"
        className="py-1 text-center text-xs text-muted-foreground transition-colors hover:text-foreground"
        onClick={onDismiss}
      >
        {t("llmChat.analysis.dismiss")}
      </button>
    </div>
  );
}
