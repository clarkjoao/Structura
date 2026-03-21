import type { DragEvent } from "react";
import { motion } from "framer-motion";
import { MoreHorizontal } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatTimestamp } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { levelColors } from "./dashboard.constants";
import type { DiagramGridProps } from "./dashboard.types";

export function DiagramGrid({
  diagrams,
  onOpen,
  onDelete,
  onDragStart,
  levelLabels,
}: DiagramGridProps) {
  const { t } = useTranslation();
  if (diagrams.length === 0) return null;
  return (
    <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {diagrams.map((d, i) => (
        <motion.div
          key={d.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.03 }}
          draggable
          onDragStart={(e) => onDragStart(e as unknown as DragEvent, d.id)}
          onClick={() => onOpen(d)}
          className="group cursor-pointer rounded-lg border border-border bg-card overflow-hidden transition-all hover:border-primary/30 hover:shadow-[0_0_20px_-6px_hsl(var(--primary)/0.15)]"
        >
          <div className="relative h-28 bg-muted/30 flex items-center justify-center border-b border-border/50">
            <div className="flex items-center gap-3 opacity-40">
              <div className="h-6 w-10 rounded border border-current" />
              <div className="h-px w-6 bg-current" />
              <div className="h-6 w-10 rounded border border-current" />
            </div>
            <div className="absolute inset-0 bg-primary/5 opacity-0 group-hover:opacity-100 transition-opacity" />
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
                <DropdownMenuContent
                  align="end"
                  onClick={(e) => e.stopPropagation()}
                >
                  <DropdownMenuItem onClick={() => onOpen(d)}>
                    {t("common.open")}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => onDelete(e, d.id)}
                  >
                    {t("common.delete")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
          <div className="p-3">
            <p className="text-sm font-medium text-foreground truncate mb-1.5">
              {d.name}
            </p>
            <div className="flex items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                  levelColors[d.level] ?? "bg-muted text-muted-foreground",
                )}
              >
                {levelLabels[d.level]}
              </span>
              <span
                className="text-[11px] text-muted-foreground/60 ml-auto"
                title={`${t("common.created")}: ${formatTimestamp(d.createdAt)}`}
              >
                {formatTimestamp(d.updatedAt)}
              </span>
            </div>
            {d.domain && (
              <p className="text-[11px] text-muted-foreground mt-1 truncate">
                {d.domain}
              </p>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
