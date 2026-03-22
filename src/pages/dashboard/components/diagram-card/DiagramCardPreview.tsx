import type { MouseEvent } from "react";
import { Copy, FolderInput, Pencil, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Diagram } from "@/features/diagram";
import { CardAction } from "./CardAction";
import { PlaceholderPreview } from "./PlaceholderPreview";

export interface DiagramCardPreviewProps {
  diagram: Diagram;
  preview: string | null;
  isPreviewHovered: boolean;
  onPreviewMouseEnter: () => void;
  onPreviewMouseLeave: () => void;
  onRename: (event: MouseEvent) => void;
  onDuplicate: (event: MouseEvent) => void;
  onMove: (event: MouseEvent) => void;
  onDelete: (event: MouseEvent) => void;
}

export function DiagramCardPreview({
  diagram,
  preview,
  isPreviewHovered,
  onPreviewMouseEnter,
  onPreviewMouseLeave,
  onRename,
  onDuplicate,
  onMove,
  onDelete,
}: DiagramCardPreviewProps) {
  const { t } = useTranslation();

  return (
    <div
      className="relative h-[160px] bg-muted/30 rounded-t-lg overflow-hidden border-b border-border"
      onMouseEnter={onPreviewMouseEnter}
      onMouseLeave={onPreviewMouseLeave}
      style={{ position: "relative" }}
    >
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
      {isPreviewHovered ? (
        <div
          role="presentation"
          onPointerDown={(event) => event.stopPropagation()}
          style={{
            position: "absolute",
            top: 8,
            right: 8,
            display: "flex",
            gap: 4,
          }}
        >
          <CardAction
            icon={<Pencil size={13} />}
            title={t("dashboard.card.rename")}
            onClick={onRename}
          />
          <CardAction
            icon={<Copy size={13} />}
            title={t("dashboard.card.duplicate")}
            onClick={onDuplicate}
          />
          <CardAction
            icon={<FolderInput size={13} />}
            title={t("dashboard.card.move")}
            onClick={onMove}
          />
          <CardAction
            icon={<Trash2 size={13} />}
            title={t("dashboard.card.delete")}
            onClick={onDelete}
            variant="danger"
          />
        </div>
      ) : null}
    </div>
  );
}
