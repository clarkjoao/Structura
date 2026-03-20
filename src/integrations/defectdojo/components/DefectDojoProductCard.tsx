import type { DDSearchResult } from "../types";
import { useTranslation } from "react-i18next";

const CRITICALITY_COLORS: Record<string, string> = {
  critical: "bg-destructive/10 text-destructive border-destructive/30",
  high: "bg-orange-500/10 text-orange-600 border-orange-500/30",
  medium: "bg-yellow-500/10 text-yellow-600 border-yellow-500/30",
  low: "bg-blue-500/10 text-blue-600 border-blue-500/30",
};

interface Props {
  product: DDSearchResult;
  selected: boolean;
  onToggle: (id: number) => void;
}

export function DefectDojoProductCard({ product, selected, onToggle }: Props) {
  const { t } = useTranslation();
  const isImported = product.status === "imported";
  const isUpdated = product.status === "updated";
  const critColor =
    CRITICALITY_COLORS[product.business_criticality?.toLowerCase() ?? ""] ??
    "bg-secondary text-secondary-foreground border-border";

  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-3 transition-colors ${
        isImported
          ? "border-border bg-secondary/30"
          : selected
            ? "border-primary/50 bg-primary/5"
            : "border-border bg-card hover:bg-secondary/30"
      }`}
    >
      <input
        type="checkbox"
        checked={selected}
        disabled={isImported}
        onChange={() => onToggle(product.id)}
        className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-primary disabled:cursor-not-allowed disabled:opacity-50"
      />

      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-sm font-semibold text-foreground">
            {product.name}
          </span>

          {isImported && (
            <span className="inline-flex items-center rounded-full border border-green-500/30 bg-green-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-green-600">
              {t("defectdojo.badgeImported")}
            </span>
          )}
          {isUpdated && (
            <span className="inline-flex items-center rounded-full border border-yellow-500/30 bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-semibold text-yellow-600">
              {t("defectdojo.badgeUpdated")}
            </span>
          )}

          {product.prod_type && (
            <span className="rounded-full border border-border bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground">
              {product.prod_type.name}
            </span>
          )}

          {product.business_criticality && (
            <span
              className={`rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${critColor}`}
            >
              {product.business_criticality}
            </span>
          )}
        </div>

        {product.description && (
          <p className="line-clamp-2 text-xs text-muted-foreground">
            {product.description}
          </p>
        )}

        {product.tags.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {product.tags.map((tag) => (
              <span
                key={tag}
                className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-secondary-foreground"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
