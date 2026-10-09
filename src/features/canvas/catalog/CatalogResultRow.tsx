import { useTranslation } from "react-i18next";
import { findMatchRanges } from "@/features/elements/search";
import { cn } from "@/lib/utils";
import { CatalogEntryIcon } from "./CatalogEntryIcon";
import type { CatalogOption } from "./catalogViewModel";
import { HighlightedText } from "./HighlightedText";
import { Kbd } from "./Kbd";

interface CatalogResultRowProps {
  item: CatalogOption;
  query: string;
  variant: "best" | "row";
  /** The group badge on the best match; rows sit under their group's heading. */
  groupLabel?: string;
  active: boolean;
  optionProps: React.ButtonHTMLAttributes<HTMLButtonElement> & {
    "aria-selected": boolean;
    draggable: boolean;
  };
}

/** One search hit: the name, and why it matched when it was not the name. */
export function CatalogResultRow({
  item,
  query,
  variant,
  groupLabel,
  active,
  optionProps,
}: CatalogResultRowProps) {
  const { t } = useTranslation();
  const { entry, hit } = item;
  const nameRanges = hit?.matchedOn === "name" ? hit.ranges : [];
  const best = variant === "best";

  return (
    <button
      type="button"
      {...optionProps}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg border text-left transition-colors",
        best ? "px-3 py-2.5" : "px-2 py-1.5",
        active ? "border-primary bg-primary/10" : "border-transparent hover:bg-surface-hover",
      )}
    >
      <CatalogEntryIcon entry={entry} size={best ? 28 : 18} />
      <span className="min-w-0 flex-1">
        <span
          className={cn("block truncate text-foreground", best ? "text-sm font-medium" : "text-xs")}
        >
          <HighlightedText text={entry.label} ranges={nameRanges} />
        </span>
        {best && entry.description && (
          <span className="block truncate text-xs text-muted-foreground">
            <HighlightedText
              text={entry.description}
              ranges={findMatchRanges(entry.description, query)}
            />
          </span>
        )}
        {hit && hit.matchedOn !== "name" && (
          <span className="block truncate text-[11px] text-muted-foreground">
            {t(`elementCatalog.matchedOn.${hit.matchedOn}`)}:{" "}
            <HighlightedText text={hit.matchedText} ranges={hit.ranges} />
          </span>
        )}
      </span>
      {best && groupLabel && (
        <span className="shrink-0 rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground">
          {groupLabel}
        </span>
      )}
      {best && <Kbd>↵</Kbd>}
    </button>
  );
}
