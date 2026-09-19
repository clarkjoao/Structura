import type { Diagram } from "@/features/diagram";
import { PlaceholderPreview } from "./PlaceholderPreview";
import { useTranslation } from "react-i18next";

export interface DiagramCardPreviewProps {
  diagram: Diagram;
  preview: string | null;
}

export function DiagramCardPreview({ diagram, preview }: DiagramCardPreviewProps) {
  const { t } = useTranslation();

  return (
    <div className="relative h-[140px] bg-muted/30 rounded-t-lg overflow-hidden border-b border-border">
      <div className="absolute inset-0 flex items-center justify-center">
        {preview ? (
          <img
            src={`data:image/svg+xml;utf8,${encodeURIComponent(preview)}`}
            alt={t("dashboard.diagramPreviewAlt", { name: diagram.name })}
            className="w-full h-full object-contain p-3 pointer-events-none"
            loading="lazy"
          />
        ) : (
          <PlaceholderPreview />
        )}
      </div>
      <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
    </div>
  );
}
