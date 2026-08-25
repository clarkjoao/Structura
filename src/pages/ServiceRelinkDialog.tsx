import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link2, Link2Off } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type {
  ServiceMatchSignal,
  ServiceRelinkPlan,
} from "@/features/integrations/service-matching";
import type { ServiceRelinkDecisions } from "./apply-service-relink";

const SIGNAL_LABEL_KEY: Record<ServiceMatchSignal, string> = {
  "github-repo-id": "serviceRelink.signalGithubRepoId",
  "repository-url": "serviceRelink.signalRepositoryUrl",
  name: "serviceRelink.signalName",
  "github-full-name": "serviceRelink.signalGithubFullName",
  "component-link": "serviceRelink.signalComponentLink",
};

export interface ServiceRelinkDialogProps {
  open: boolean;
  plan: ServiceRelinkPlan;
  onCancel: () => void;
  onConfirm: (decisions: ServiceRelinkDecisions) => void;
}

/**
 * Nothing is remapped behind the user's back: a service link is part of the model, and a wrong
 * guess is harder to notice than a missing one. The dialog shows which signals matched so the
 * decision can be checked rather than trusted.
 */
export function ServiceRelinkDialog({ open, plan, onCancel, onConfirm }: ServiceRelinkDialogProps) {
  const { t } = useTranslation();
  const [acceptedRelinks, setAcceptedRelinks] = useState<Set<string>>(
    () => new Set(plan.relink.map((item) => item.entry.id)),
  );
  const [clearedIds, setClearedIds] = useState<Set<string>>(() => new Set());

  const allRelinkSelected = useMemo(
    () => plan.relink.every((item) => acceptedRelinks.has(item.entry.id)),
    [plan.relink, acceptedRelinks],
  );

  const toggle = (set: Set<string>, id: string): Set<string> => {
    const next = new Set(set);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    return next;
  };

  const handleConfirm = () => {
    const remap: Record<string, string> = {};
    for (const item of plan.relink) {
      if (acceptedRelinks.has(item.entry.id)) remap[item.entry.id] = item.service.id;
    }
    onConfirm({ remap, clear: [...clearedIds] });
  };

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onCancel()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t("serviceRelink.title")}</DialogTitle>
          <DialogDescription>{t("serviceRelink.description")}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-4 overflow-y-auto pr-1">
          {plan.relink.length > 0 && (
            <section>
              <header className="mb-2 flex items-center justify-between gap-2">
                <h3 className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  <Link2 className="h-3 w-3" aria-hidden />
                  {t("serviceRelink.relinkGroup")}
                </h3>
                <button
                  type="button"
                  onClick={() =>
                    setAcceptedRelinks(
                      allRelinkSelected
                        ? new Set()
                        : new Set(plan.relink.map((item) => item.entry.id)),
                    )
                  }
                  className="text-[11px] font-medium text-primary hover:underline"
                >
                  {t("serviceRelink.selectAll")}
                </button>
              </header>
              <ul className="space-y-2">
                {plan.relink.map((item) => (
                  <li key={item.entry.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2.5">
                      <Checkbox
                        className="mt-0.5"
                        checked={acceptedRelinks.has(item.entry.id)}
                        onCheckedChange={() =>
                          setAcceptedRelinks((prev) => toggle(prev, item.entry.id))
                        }
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {item.entry.name} → {item.service.name}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {item.signals.map((signal) => t(SIGNAL_LABEL_KEY[signal])).join(" · ")}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {t("serviceRelink.usedByComponents", {
                            count: item.componentIds.length,
                          })}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {plan.unmatched.length > 0 && (
            <section>
              <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Link2Off className="h-3 w-3" aria-hidden />
                {t("serviceRelink.unmatchedGroup")}
              </h3>
              <ul className="space-y-2">
                {plan.unmatched.map((item) => (
                  <li key={item.entry.id}>
                    <label className="flex cursor-pointer items-start gap-2 rounded-lg border border-border p-2.5">
                      <Checkbox
                        className="mt-0.5"
                        checked={clearedIds.has(item.entry.id)}
                        onCheckedChange={() => setClearedIds((prev) => toggle(prev, item.entry.id))}
                      />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {item.entry.name}
                        </span>
                        <span className="block text-[11px] text-muted-foreground">
                          {t("serviceRelink.clearDangling")}
                        </span>
                        {item.ambiguousCandidates.length > 0 && (
                          <span className="block text-[11px] text-muted-foreground">
                            {t("serviceRelink.ambiguous")}
                          </span>
                        )}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {plan.alreadyLocal.length > 0 && (
            <p className="text-[11px] text-muted-foreground">
              {t("serviceRelink.alreadyLocalGroup", { count: plan.alreadyLocal.length })}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel}>
            {t("serviceRelink.cancel")}
          </Button>
          <Button onClick={handleConfirm}>{t("serviceRelink.confirm")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
