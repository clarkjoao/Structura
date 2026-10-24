import type { ReactNode } from "react";
import { Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useCollab } from "@/features/collaboration";
import { cn } from "@/lib/utils";
import { Kbd } from "../catalog/Kbd";
import { PANEL_ADD_CLASS, PANEL_LABEL_CLASS } from "../panels/ElementPanel/shell/fieldStyles";

export interface LinkTriggerProps {
  /** An anchor id other code scrolls to. */
  anchorId: string;
  /** Icon and text of the field's label ("Linked diagram"). */
  icon: ReactNode;
  label: string;
  /** What the element is linked to, by name; null while unlinked. */
  linkedName: string | null;
  /** The link points at something that is gone: shown, so it can be seen and removed. */
  broken?: boolean;
  /** "Link a diagram" / "Link a service": what the empty trigger offers. */
  emptyLabel: string;
  missingLabel: string;
  unlinkLabel: string;
  onOpen: () => void;
  onUnlink: () => void;
  /** Buttons beside the trigger (open the target, …). */
  actions?: ReactNode;
  /** Controls on the label's row, right-aligned (sync). */
  headerActions?: ReactNode;
}

/**
 * The panel's link field, the same for a diagram and a service: it shows what the element is linked
 * to and opens the link palette to change it. Unlink is its own link; there is no "None" to hunt for.
 */
export function LinkTrigger({
  anchorId,
  icon,
  label,
  linkedName,
  broken = false,
  emptyLabel,
  missingLabel,
  unlinkLabel,
  onOpen,
  onUnlink,
  actions,
  headerActions,
}: LinkTriggerProps) {
  const { t } = useTranslation();
  const { isGuest } = useCollab();
  return (
    <div id={anchorId} className="relative flex flex-col gap-1">
      {isGuest && (
        <div
          className="absolute inset-0 z-10 flex cursor-not-allowed items-center justify-center rounded-md bg-background/60 backdrop-blur-[1px]"
          title={t("collaboration.notAvailableInCollab")}
        >
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground shadow-sm">
            <Lock className="h-3 w-3" />
            {t("collaboration.notAvailableInCollab")}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <span className={cn(PANEL_LABEL_CLASS, "mb-0 flex items-center gap-1")}>
          {icon}
          {label}
        </span>
        {headerActions}
      </div>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={onOpen}
          className={cn(
            linkedName
              ? "flex h-8 min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-border bg-secondary px-2.5 text-left text-sm text-foreground transition-colors hover:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              : cn(PANEL_ADD_CLASS, "min-w-0 flex-1 justify-between"),
            broken && "border-destructive/50",
          )}
        >
          <span className="truncate">
            {linkedName ?? `+ ${emptyLabel}`}
            {broken && ` (${missingLabel})`}
          </span>
          <Kbd className="shrink-0">↵</Kbd>
        </button>
        {actions}
      </div>
      {linkedName && (
        <button
          type="button"
          onClick={onUnlink}
          className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {unlinkLabel}
        </button>
      )}
    </div>
  );
}
