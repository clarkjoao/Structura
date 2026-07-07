import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronUp, X } from "lucide-react";
import type { WalkthroughStep } from "../../types";

interface StepDescriptionBadgeProps {
  step: WalkthroughStep;
  stepIndex: number;
  totalSteps: number;
}

export function StepDescriptionBadge({ step, stepIndex, totalSteps }: StepDescriptionBadgeProps) {
  const { t } = useTranslation();
  const [collapsed, setCollapsed] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setCollapsed(false);
    setDismissed(false);
  }, [step.id]);

  if (dismissed) return null;

  return (
    <div className="absolute left-4 top-4 z-10 w-72 rounded-xl border border-border bg-card/95 shadow-xl backdrop-blur-sm">
      <div className="flex items-center gap-2 px-3 py-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold tabular-nums text-primary">
          {stepIndex + 1}
        </span>
        <span className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
          {step.label}
        </span>
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
          {stepIndex + 1}/{totalSteps}
        </span>
        {step.description ? (
          <button
            type="button"
            className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={
              collapsed
                ? t("walkthroughs.editor.expandDescription")
                : t("walkthroughs.editor.collapseDescription")
            }
          >
            {collapsed ? (
              <ChevronDown className="h-3.5 w-3.5" />
            ) : (
              <ChevronUp className="h-3.5 w-3.5" />
            )}
          </button>
        ) : null}
        <button
          type="button"
          className="shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          onClick={() => setDismissed(true)}
          aria-label={t("common.close")}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {step.description && !collapsed ? (
        <div className="border-t border-border px-3 py-2.5">
          <p className="text-xs leading-relaxed text-muted-foreground">{step.description}</p>
        </div>
      ) : null}
    </div>
  );
}
