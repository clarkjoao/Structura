import { useTranslation } from "react-i18next";
import { ArrowRight, Box, Play } from "lucide-react";
import type { Diagram } from "@/features/diagram";
import { formatTimestamp } from "@/lib/format-date";
import { cn } from "@/lib/utils";
import { levelColors } from "../../dashboard.constants";
import { StatChip } from "./StatChip";

export interface DiagramCardFooterProps {
  diagram: Diagram;
  levelLabels: Record<string, string>;
  componentCount: number;
  connectionCount: number;
  flowCount: number;
}

export function DiagramCardFooter({
  diagram,
  levelLabels,
  componentCount,
  connectionCount,
  flowCount,
}: DiagramCardFooterProps) {
  const { t } = useTranslation();

  return (
    <div className="p-3">
      <p
        style={{
          fontSize: 14,
          fontWeight: 500,
          color: "hsl(var(--foreground))",
          margin: "0 0 4px",
        }}
        className="truncate"
      >
        {diagram.name}
      </p>
      {diagram.description ? (
        <p
          style={{
            fontSize: 12,
            color: "hsl(var(--muted-foreground))",
            margin: "0 0 6px",
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
          }}
          title={diagram.description}
        >
          {diagram.description}
        </p>
      ) : null}
      <div style={{ display: "flex", gap: 10, marginBottom: 6, flexWrap: "wrap" }}>
        <StatChip
          icon={<Box size={11} />}
          value={componentCount}
          label={t("dashboard.card.components")}
        />
        <StatChip
          icon={<ArrowRight size={11} />}
          value={connectionCount}
          label={t("dashboard.card.connections")}
        />
        {flowCount > 0 ? (
          <StatChip
            icon={<Play size={11} />}
            value={flowCount}
            label={t("dashboard.card.flows")}
          />
        ) : null}
      </div>
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
      {diagram.domain ? (
        <p className="text-[11px] text-muted-foreground mt-1 truncate">{diagram.domain}</p>
      ) : null}
    </div>
  );
}
