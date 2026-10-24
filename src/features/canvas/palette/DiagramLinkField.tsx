import { useState } from "react";
import { ArrowUpRight, LayoutDashboard, Lock } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useDiagramStore } from "@/features/diagram";
import { useCollab } from "@/features/collaboration";
import { Kbd } from "../catalog/Kbd";
import { PANEL_ADD_CLASS, PANEL_LABEL_CLASS } from "../panels/ElementPanel/shell/fieldStyles";
import { cn } from "@/lib/utils";
import { DiagramLinkPalette } from "./DiagramLinkPalette";
import { stripImportedSuffix } from "./diagramLinkItems";

export interface DiagramLinkFieldProps {
  /** For the anchor other code scrolls to. */
  componentId: string;
  /** The field's label: "Linked diagram", "Target diagram". */
  label: string;
  elementName: string;
  linkedDiagramId: string | null | undefined;
  canCreate: boolean;
  /** Linking an element to a diagram. `undefined` unlinks. */
  onLink: (diagramId: string | undefined) => void;
  onCreateAndLink: () => void;
}

/**
 * The panel's diagram link, as a trigger rather than a dropdown: it shows what the element is
 * linked to and opens the link palette to change it. Unlink is its own button; there is no
 * "None" entry to hunt for.
 */
export function DiagramLinkField({
  componentId,
  label,
  elementName,
  linkedDiagramId,
  canCreate,
  onLink,
  onCreateAndLink,
}: DiagramLinkFieldProps) {
  const { t } = useTranslation();
  const { isGuest } = useCollab();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const linkedName = useDiagramStore((s) =>
    linkedDiagramId ? s.diagrams[linkedDiagramId]?.name : undefined,
  );
  const linked = linkedDiagramId
    ? stripImportedSuffix(linkedName ?? "").name || linkedDiagramId
    : null;
  // A link to a diagram that is gone still shows, so it can be seen and removed.
  const broken = Boolean(linkedDiagramId) && linkedName === undefined;

  return (
    <div id={`element-panel-linked-${componentId}`} className="relative flex flex-col gap-1">
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
      <span className={cn(PANEL_LABEL_CLASS, "flex items-center gap-1")}>
        <LayoutDashboard className="h-3 w-3" />
        {label}
      </span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={cn(
            linked
              ? "flex h-8 min-w-0 flex-1 items-center justify-between gap-2 rounded-md border border-border bg-secondary px-2.5 text-left text-sm text-foreground transition-colors hover:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              : cn(PANEL_ADD_CLASS, "min-w-0 flex-1 justify-between"),
            broken && "border-destructive/50",
          )}
        >
          <span className="truncate">
            {linked ?? `+ ${t("diagramLink.linkAction")}`}
            {broken && ` (${t("diagramLink.missing")})`}
          </span>
          <Kbd className="shrink-0">↵</Kbd>
        </button>
        {linked && !broken && (
          <button
            type="button"
            title={t("diagramLink.open")}
            aria-label={t("diagramLink.open")}
            onClick={() => navigate(`/model/${linkedDiagramId}`)}
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
          >
            <ArrowUpRight className="h-4 w-4" />
          </button>
        )}
      </div>
      {linked && (
        <button
          type="button"
          onClick={() => onLink(undefined)}
          className="self-start text-xs text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
        >
          {t("diagramLink.unlink")}
        </button>
      )}
      <DiagramLinkPalette
        open={open}
        onOpenChange={setOpen}
        elementName={elementName}
        currentDiagramId={linkedDiagramId}
        canCreate={canCreate}
        onPick={(diagramId, pick) => {
          onLink(diagramId);
          if (pick.open) navigate(`/model/${diagramId}`);
        }}
        onCreate={() => onCreateAndLink()}
      />
    </div>
  );
}
