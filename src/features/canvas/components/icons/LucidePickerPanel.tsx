import dynamicIconImports from "lucide-react/dynamicIconImports";
import { Suspense, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { getLazyLucideIcon } from "./lucideDynamicIcon";

const LUCIDE_PICKER_RESULT_LIMIT = 60;
const ICON_PREVIEW_SIZE = 24;

const allIconNames = Object.keys(dynamicIconImports) as (keyof typeof dynamicIconImports)[];

interface LucidePickerIconCardProps {
  iconKey: keyof typeof dynamicIconImports;
  onSelect: (iconName: string) => void;
}

function LucidePickerIconCard({ iconKey, onSelect }: LucidePickerIconCardProps) {
  const LazyLucideIcon = getLazyLucideIcon(iconKey);
  const iconNameString = iconKey as string;
  const fallbackStyle = { width: ICON_PREVIEW_SIZE, height: ICON_PREVIEW_SIZE };

  return (
    <button
      type="button"
      onClick={() => onSelect(iconNameString)}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border border-border p-2 text-center transition-colors hover:bg-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
    >
      <div
        className="flex shrink-0 items-center justify-center"
        style={{ width: ICON_PREVIEW_SIZE, height: ICON_PREVIEW_SIZE }}
      >
        <Suspense fallback={<div style={fallbackStyle} />}>
          <LazyLucideIcon
            size={ICON_PREVIEW_SIZE}
            className="shrink-0"
            style={{ pointerEvents: "none" }}
          />
        </Suspense>
      </div>
      <span className="line-clamp-2 w-full break-all text-muted-foreground" style={{ fontSize: 10 }}>
        {iconNameString}
      </span>
    </button>
  );
}

export interface LucidePickerPanelProps {
  onSelect: (iconName: string) => void;
}

export function LucidePickerPanel({ onSelect }: LucidePickerPanelProps) {
  const { t } = useTranslation();
  const [searchQuery, setSearchQuery] = useState("");

  const { visibleNames, totalMatches } = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matched = query
      ? allIconNames.filter((name) => (name as string).toLowerCase().includes(query))
      : allIconNames;
    return {
      visibleNames: matched.slice(0, LUCIDE_PICKER_RESULT_LIMIT),
      totalMatches: matched.length,
    };
  }, [searchQuery]);

  return (
    <div className="flex flex-col gap-3">
      <Input
        type="search"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder={t("icons.lucide.searchPlaceholder")}
        aria-label={t("icons.lucide.searchPlaceholder")}
      />
      <p className="text-xs text-muted-foreground">
        {t("icons.lucide.resultsCount", {
          shown: visibleNames.length,
          total: totalMatches,
        })}
      </p>
      {visibleNames.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("icons.emptyLibrary")}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {visibleNames.map((iconKey) => (
            <LucidePickerIconCard key={iconKey as string} iconKey={iconKey} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
