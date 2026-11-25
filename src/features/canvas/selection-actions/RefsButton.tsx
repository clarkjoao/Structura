import { Link2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Component } from "@/features/diagram";
import { sharedMode } from "@/features/diagram/utils/shared";
import { cn } from "@/lib/utils";
import { useReferenceUsage } from "../shared/useReferenceUsage";
import { requestReferencesTab } from "./referencesTab.store";

/**
 * The element's references, one labelled button on its toolbar: it opens the inspector's
 * References tab, where they are made, listed and followed.
 */
export function RefsButton({ component }: { component: Component }) {
  const { t } = useTranslation();
  const { refs } = useReferenceUsage(component.id);
  const shared = sharedMode(component) !== "edges" || refs.length > 0;

  return (
    <button
      type="button"
      data-testid="refs-button"
      onClick={() => requestReferencesTab(component.id)}
      className={cn(
        "flex h-6 items-center gap-1 rounded px-1.5 text-xs transition-colors hover:bg-surface-hover hover:text-foreground",
        shared ? "text-primary" : "text-muted-foreground",
      )}
      title={t("shared.menu.openTab")}
      aria-label={t("shared.menu.openTab")}
    >
      <Link2 className="h-3.5 w-3.5" aria-hidden />
      <span>{t("shared.menu.trigger")}</span>
      {refs.length > 0 && (
        <span className="font-mono text-[10px] text-muted-foreground">{refs.length}</span>
      )}
    </button>
  );
}
