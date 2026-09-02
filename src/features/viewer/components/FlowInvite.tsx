import { Play } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Flow } from "@/features/diagram";

interface Props {
  flows: readonly Flow[];
  onSelect: (flowId: string) => void;
}

/**
 * What tells a reader the diagram has something to be read.
 *
 * It names the scripts rather than counting them: "3 roteiros" asks the reader
 * to go looking, where "Checkout, Refund, Chargeback" is already the answer.
 * It sits over the canvas instead of in front of it — a diagram is worth
 * looking at on its own, and a reader who wants only the picture should not
 * have to dismiss anything to get it.
 *
 * Nothing is numbered until one is chosen: the open script is what numbers the
 * canvas, and before the choice there is no open script.
 */
export function FlowInvite({ flows, onSelect }: Props) {
  const { t } = useTranslation();
  if (flows.length === 0) return null;

  return (
    <div
      data-testid="viewer-flow-invite"
      className="absolute bottom-6 left-1/2 z-20 flex max-w-[min(90vw,42rem)] -translate-x-1/2 flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-border bg-card/95 px-4 py-3 shadow-2xl backdrop-blur-sm"
    >
      <span className="text-xs text-muted-foreground">
        {t("viewerFlows.invite", { count: flows.length })}
      </span>
      <div className="flex flex-wrap items-center gap-1.5">
        {flows.map((flow) => (
          <button
            type="button"
            key={flow.id}
            onClick={() => onSelect(flow.id)}
            title={t("viewerFlows.read", { name: flow.name })}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-secondary px-2.5 py-1.5 text-xs font-medium text-foreground transition-colors hover:border-primary/40 hover:bg-surface-hover"
          >
            <Play className="h-3 w-3 shrink-0 text-primary" />
            <span className="max-w-[14rem] truncate">{flow.name}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
