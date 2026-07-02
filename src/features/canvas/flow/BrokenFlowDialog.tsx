import { AlertTriangle, ArrowRight, Box } from "lucide-react";
import type { Flow } from "@/features/diagram";
import type { BrokenStep } from "./validateFlow";
import { useTranslation } from "react-i18next";

interface Props {
  flow: Flow;
  brokenSteps: BrokenStep[];
  onRemoveSteps: (stepIds: string[]) => void;
  onCancel: () => void;
}

const BrokenFlowDialog = ({ flow, brokenSteps, onRemoveSteps, onCancel }: Props) => {
  const { t } = useTranslation();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-[480px] rounded-xl border border-border bg-card shadow-2xl">
        <div className="flex items-center gap-2.5 px-5 py-4 border-b border-border">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t("brokenFlow.title")}</h2>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {t("brokenFlow.descriptionWithName", { name: flow.name })}
            </p>
          </div>
        </div>

        <div className="px-5 py-3 max-h-[280px] overflow-y-auto space-y-1.5">
          {brokenSteps.map((b) => (
            <div
              key={b.stepId}
              className="flex items-center gap-2 rounded-md border border-border bg-secondary/50 px-3 py-2"
            >
              <span className="flex items-center justify-center w-6 h-6 rounded bg-amber-500/10 text-amber-400 text-[10px] font-bold shrink-0">
                {b.stepId.slice(0, 4)}
              </span>
              {b.reason === "component_deleted" ? (
                <Box className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              ) : (
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              )}
              <span className="text-xs text-foreground flex-1 min-w-0 truncate">{b.label}</span>
              <span className="text-[10px] rounded bg-destructive/10 text-destructive px-1.5 py-0.5 shrink-0">
                {b.reason === "component_deleted"
                  ? t("brokenFlow.componentDeleted")
                  : t("brokenFlow.connectionRemoved")}
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-border">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-border rounded-md transition-colors"
          >
            {t("brokenFlow.cancel")}
          </button>
          <button
            onClick={() => onRemoveSteps(brokenSteps.map((b) => b.stepId))}
            className="px-3 py-1.5 text-xs font-semibold text-primary-foreground bg-primary hover:bg-primary/90 rounded-md transition-colors"
          >
            {t("brokenFlow.removeInvalid")}
          </button>
        </div>
      </div>
    </div>
  );
};

export default BrokenFlowDialog;
