import { useState } from "react";
import { ArrowUpRight, LayoutDashboard } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { useDiagramStore } from "@/features/diagram";
import { DiagramLinkPalette } from "./DiagramLinkPalette";
import { LinkTrigger } from "./LinkTrigger";
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
    <>
      <LinkTrigger
        anchorId={`element-panel-linked-${componentId}`}
        icon={<LayoutDashboard className="h-3 w-3" />}
        label={label}
        linkedName={linked}
        broken={broken}
        emptyLabel={t("diagramLink.linkAction")}
        missingLabel={t("diagramLink.missing")}
        unlinkLabel={t("diagramLink.unlink")}
        onOpen={() => setOpen(true)}
        onUnlink={() => onLink(undefined)}
        actions={
          linked && !broken ? (
            <button
              type="button"
              title={t("diagramLink.open")}
              aria-label={t("diagramLink.open")}
              onClick={() => navigate(`/model/${linkedDiagramId}`)}
              className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-accent hover:text-foreground"
            >
              <ArrowUpRight className="h-4 w-4" />
            </button>
          ) : null
        }
      />
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
    </>
  );
}
