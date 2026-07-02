import { Download, Share2, X } from "lucide-react";
import { useTranslation } from "react-i18next";

interface SharedDiagramBannerProps {
  diagramName: string;
  onImport: () => void;
  onClose: () => void;
}

const SharedDiagramBanner = ({ diagramName, onImport, onClose }: SharedDiagramBannerProps) => {
  const { t } = useTranslation();

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 12,
        padding: "10px 20px",
        background: "var(--color-background-info)",
        borderBottom: "1px solid var(--color-border-info)",
      }}
    >
      <Share2 size={16} style={{ color: "var(--color-text-info)", flexShrink: 0 }} />

      <div style={{ flex: 1, minWidth: 0 }}>
        <span
          style={{
            fontSize: 13,
            color: "var(--color-text-info)",
            fontWeight: 500,
          }}
        >
          {t("share.previewBanner.title", { name: diagramName })}
        </span>
        <span
          style={{
            fontSize: 12,
            color: "var(--color-text-info)",
            opacity: 0.8,
            marginLeft: 8,
          }}
        >
          {t("share.previewBanner.subtitle")}
        </span>
      </div>

      <div style={{ display: "flex", gap: 8, flexShrink: 0 }}>
        <button
          type="button"
          onClick={onImport}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 14px",
            background: "var(--color-text-info)",
            color: "var(--color-background-primary)",
            border: "none",
            borderRadius: "var(--border-radius-md)",
            fontSize: 12,
            fontWeight: 500,
            cursor: "pointer",
          }}
        >
          <Download size={13} />
          {t("share.previewBanner.openInStructura")}
        </button>

        <button
          type="button"
          onClick={onClose}
          aria-label={t("share.previewBanner.close")}
          title={t("share.previewBanner.close")}
          style={{
            display: "flex",
            alignItems: "center",
            padding: "6px 10px",
            background: "transparent",
            color: "var(--color-text-info)",
            border: "1px solid var(--color-border-info)",
            borderRadius: "var(--border-radius-md)",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          <X size={13} />
        </button>
      </div>
    </div>
  );
};

export default SharedDiagramBanner;
