import { Clock, Network, Trash2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import { formatTimestamp } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { levelColors } from "./dashboard.constants";
import type { DiagramListProps } from "./dashboard.types";

export function DiagramList({
  diagrams,
  onOpen,
  onDelete,
  onDragStart,
  levelLabels,
}: DiagramListProps) {
  const { t } = useTranslation();
  if (diagrams.length === 0) return null;
  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="w-10 px-3 py-2.5" />
            <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t("common.name")}
            </th>
            <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t("common.domain")}
            </th>
            <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t("common.c4Level")}
            </th>
            <th className="text-left px-3 py-2.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
              {t("common.edited")}
            </th>
            <th className="w-10 px-3 py-2.5" />
          </tr>
        </thead>
        <tbody>
          {diagrams.map((d) => (
            <tr
              key={d.id}
              draggable
              onDragStart={(e) => onDragStart(e, d.id)}
              onClick={() => onOpen(d)}
              className="border-b border-border/50 last:border-0 cursor-pointer hover:bg-muted/30 transition-colors group"
            >
              <td className="px-3 py-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10">
                  <Network className="h-3.5 w-3.5 text-primary" />
                </div>
              </td>
              <td className="px-3 py-2.5 font-medium text-foreground">
                {d.name}
              </td>
              <td className="px-3 py-2.5 text-muted-foreground">
                {d.domain ?? t("common.emDash")}
              </td>
              <td className="px-3 py-2.5">
                <span
                  className={cn(
                    "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium",
                    levelColors[d.level] ?? "bg-muted text-muted-foreground",
                  )}
                >
                  {levelLabels[d.level]}
                </span>
              </td>
              <td className="px-3 py-2.5">
                <div className="flex flex-col gap-0.5">
                  <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-3 w-3" />
                    {formatTimestamp(d.updatedAt)}
                  </span>
                  <span className="text-[10px] text-muted-foreground/50 pl-4">
                    {t("common.created")}: {formatTimestamp(d.createdAt)}
                  </span>
                </div>
              </td>
              <td className="px-3 py-2.5">
                <button
                  onClick={(e) => onDelete(e, d.id)}
                  className="text-muted-foreground/50 hover:text-destructive transition-colors opacity-0 group-hover:opacity-100"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
