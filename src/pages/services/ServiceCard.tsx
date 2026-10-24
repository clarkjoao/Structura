import { Layers } from "lucide-react";
import { useTranslation } from "react-i18next";
import { ServiceSource } from "@/features/diagram";
import { normalizeSources } from "@/features/integrations/merge-utils";
import { cn } from "@/lib/utils";
import { SOURCE_DOT } from "./services.constants";
import { sourceTypeLabel } from "./serviceLabels";
import type { ServiceCardProps } from "./types";

export const ServiceCard = ({
  svc,
  isSelected,
  isBulkSelected,
  onClick,
  usage,
}: ServiceCardProps) => {
  const { t } = useTranslation();
  // Manual is the default, so only an external source earns a mark.
  const marks = normalizeSources(svc).filter((source) => source.type !== ServiceSource.Manual);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full rounded-xl border p-4 text-left transition-all duration-150 hover:border-primary/40 hover:bg-accent/30",
        isSelected ? "border-primary/60 bg-accent/40" : "border-border bg-card",
        isBulkSelected && "ring-2 ring-primary",
        isSelected && !isBulkSelected && "ring-1 ring-primary/20",
      )}
    >
      {marks.length > 0 && (
        <span className="absolute right-3 top-3 flex items-center gap-1">
          {marks.map((source) => (
            <span
              key={source.type}
              title={sourceTypeLabel(t, source.type)}
              className={`h-2 w-2 rounded-full ${SOURCE_DOT[source.type]}`}
            />
          ))}
        </span>
      )}
      <span className="block truncate pr-6 font-mono text-sm font-semibold text-foreground">
        {svc.name}
      </span>
      <span className="mt-1 block truncate text-xs text-muted-foreground">
        {svc.technology.length > 0 ? svc.technology.join(" · ") : "\u00a0"}
      </span>
      <span className="mt-3 flex items-center gap-1 text-[11px] text-muted-foreground">
        <Layers className="h-3 w-3" />
        {t("services.diagramUsage", { count: usage.length })}
      </span>
    </button>
  );
};
