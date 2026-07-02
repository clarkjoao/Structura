import { Layers, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { normalizeSources } from "@/integrations/merge-utils";
import { cn } from "@/lib/utils";
import { SOURCE_BADGE, SOURCE_DOT } from "./registry.constants";
import { sourceTypeLabel } from "./registryLabels";
import type { ServiceCardProps } from "./types";

export const ServiceCard = ({
  svc,
  isSelected,
  isBulkSelected,
  onClick,
  usage,
}: ServiceCardProps) => {
  const { t } = useTranslation();
  const sources = normalizeSources(svc);
  const MAX_PILLS = 3;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full text-left rounded-xl border p-4 transition-all duration-150 hover:border-primary/40 hover:bg-accent/30",
        isSelected ? "border-primary/60 bg-accent/40" : "border-border bg-card",
        isBulkSelected && "ring-2 ring-primary",
        isSelected && !isBulkSelected && "ring-1 ring-primary/20",
      )}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <div className="flex items-center gap-1 shrink-0">
          {sources.map((source) => (
            <span key={source.type} className={`h-2 w-2 rounded-full ${SOURCE_DOT[source.type]}`} />
          ))}
        </div>
        <span className="font-semibold text-foreground text-sm truncate flex-1">{svc.name}</span>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-1">
          {sources.map((source) => (
            <span
              key={source.type}
              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${SOURCE_BADGE[source.type]}`}
            >
              {sourceTypeLabel(t, source.type)}
            </span>
          ))}
        </div>
      </div>

      {svc.description && (
        <p className="text-xs text-muted-foreground truncate mb-2">{svc.description}</p>
      )}

      {svc.technology.length > 0 && (
        <div className="flex flex-wrap items-center gap-1 mb-2">
          {svc.technology.slice(0, MAX_PILLS).map((techStr) => (
            <span
              key={techStr}
              className="text-[10px] font-mono rounded bg-secondary px-1.5 py-0.5 text-secondary-foreground"
            >
              {techStr}
            </span>
          ))}
          {svc.technology.length > MAX_PILLS && (
            <span className="text-[10px] text-muted-foreground">
              +{svc.technology.length - MAX_PILLS}
            </span>
          )}
        </div>
      )}

      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
        {svc.owner && (
          <span className="flex items-center gap-0.5">
            <User className="h-3 w-3" />
            {svc.owner}
          </span>
        )}
        <span className="flex items-center gap-0.5">
          <Layers className="h-3 w-3" />
          {t("registry.diagramUsage", { count: usage.length })}
        </span>
      </div>
    </button>
  );
};
