import { ExternalLink } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Diagram } from "@/features/diagram/model";
import type { ReaderCatalog } from "@/features/diagram/utils/reader-catalog";
import { generateShareUrl } from "@/lib/share-url";

interface OpenInStructuraButtonProps {
  diagram: Diagram;
  /** Carried on, so the diagram opened from here still shows its names. */
  catalog: ReaderCatalog;
}

export const OpenInStructuraButton = ({ diagram, catalog }: OpenInStructuraButtonProps) => {
  const { t } = useTranslation();
  return (
    <a
      href={generateShareUrl(diagram, { catalog }).url}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={t("viewPage.openInStructura.ariaLabel", { name: diagram.name })}
      style={{
        position: "absolute",
        top: 12,
        right: 12,
        display: "flex",
        alignItems: "center",
        gap: 6,
        padding: "6px 10px",
        background: "var(--color-background-primary)",
        border: "0.5px solid var(--color-border-secondary)",
        borderRadius: "var(--border-radius-md)",
        fontSize: 12,
        color: "var(--color-text-secondary)",
        textDecoration: "none",
        zIndex: 10,
        cursor: "pointer",
      }}
    >
      <ExternalLink size={13} />
      {t("viewPage.openInStructura.label")}
    </a>
  );
};
