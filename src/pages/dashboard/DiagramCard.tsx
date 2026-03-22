import type { DragEvent, MouseEvent } from "react";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Diagram } from "@/features/diagram";
import { formatTimestamp } from "@/lib/format-date";
import { getPreview } from "@/lib/diagram-preview";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { levelColors } from "./dashboard.constants";

interface DiagramCardProps {
  diagram: Diagram;
  index: number;
  onOpen: (diagram: Diagram) => void;
  onDelete: (event: MouseEvent, diagramId: string) => void;
  onDragStart: (event: DragEvent, diagramId: string) => void;
  levelLabels: Record<string, string>;
}

function PlaceholderPreview() {
  return (
    <div className="flex items-center gap-3 opacity-40">
      <div className="h-6 w-10 rounded border border-current" />
      <div className="h-px w-6 bg-current" />
      <div className="h-6 w-10 rounded border border-current" />
    </div>
  );
}

export function DiagramCard({
  diagram,
  index,
  onOpen,
  onDelete,
  onDragStart,
  levelLabels,
}: DiagramCardProps) {
  const { t } = useTranslation();
  const [preview, setPreview] = useState<string | null>(() => getPreview(diagram.id));

  useEffect(() => {
    setPreview(getPreview(diagram.id));
  }, [diagram.updatedAt, diagram.id]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
      draggable
      onDragStart={(e) => onDragStart(e as unknown as DragEvent, diagram.id)}
      onClick={() => onOpen(diagram)}
      className="group cursor-pointer rounded-lg border border-border bg-card overflow-hidden transition-all hover:border-primary/30 hover:shadow-[0_0_20px_-6px_hsl(var(--primary)/0.15)]"
    >
      <div className="relative h-[160px] bg-muted/30 rounded-t-lg overflow-hidden border-b border-border">
        <div className="absolute inset-0 flex items-center justify-center">
          {preview ? (
            <img
              src={`data:image/svg+xml;utf8,${encodeURIComponent(preview)}`}
              alt={t("dashboard.diagramPreviewAlt", { name: diagram.name })}
              className="w-full h-full object-contain p-3"
              loading="lazy"
            />
          ) : (
            <PlaceholderPreview />
          )}
        </div>
        <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
        <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="secondary"
                size="icon"
                className="h-7 w-7"
                onClick={(e) => e.stopPropagation()}
              >
                <MoreHorizontal className="h-3.5 w-3.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
              <DropdownMenuItem onClick={() => onOpen(diagram)}>
                {t("common.open")}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="text-destructive focus:text-destructive"
                onClick={(e) => onDelete(e, diagram.id)}
              >
                {t("common.delete")}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-foreground truncate mb-1.5">{diagram.name}</p>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
              levelColors[diagram.level] ?? "bg-muted text-muted-foreground",
            )}
          >
            {levelLabels[diagram.level]}
          </span>
          <span
            className="text-[11px] text-muted-foreground/60 ml-auto"
            title={`${t("common.created")}: ${formatTimestamp(diagram.createdAt)}`}
          >
            {formatTimestamp(diagram.updatedAt)}
          </span>
        </div>
        {diagram.domain && (
          <p className="text-[11px] text-muted-foreground mt-1 truncate">{diagram.domain}</p>
        )}
      </div>
    </motion.div>
  );
}
