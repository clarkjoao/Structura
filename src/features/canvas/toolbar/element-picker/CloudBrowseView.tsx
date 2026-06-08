import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { CloudProviderAdapter } from "@/features/cloud";
import { CloudCategoryBlock } from "./CloudCategoryBlock";

const OTHER_SECTION_KEY = "__other__";

export function CloudBrowseView({
  provider,
  primaryCategoryIds,
  expandedSubcats,
  q,
  toggleSubcat,
  onPick,
}: {
  provider: CloudProviderAdapter;
  primaryCategoryIds: string[];
  expandedSubcats: Set<string>;
  q: string;
  toggleSubcat: (id: string) => void;
  onPick: (categoryId: string, serviceId: string, serviceName: string) => void;
}) {
  const { t } = useTranslation();

  const servicesByCategory = new Map(
    provider.categories.map((cat) => [
      cat.id,
      provider.services.filter((s) => s.categoryId === cat.id),
    ]),
  );

  const primaryCategories = primaryCategoryIds
    .map((id) => provider.categories.find((c) => c.id === id))
    .filter(Boolean)
    .map((cat) => ({ ...cat!, services: servicesByCategory.get(cat!.id) ?? [] }));

  const primaryIds = new Set(primaryCategoryIds);
  const otherCategories = provider.categories
    .filter((c) => !primaryIds.has(c.id))
    .map((cat) => ({ ...cat, services: servicesByCategory.get(cat.id) ?? [] }));

  const otherCount = otherCategories.reduce((n, c) => n + c.services.length, 0);

  return (
    <div className="space-y-1">
      {primaryCategories.map((cat) => (
        <CloudCategoryBlock
          key={cat.id}
          cat={cat}
          q={q}
          expanded={expandedSubcats.has(cat.id) || !!q}
          onToggle={() => toggleSubcat(cat.id)}
          onPick={onPick}
        />
      ))}
      {otherCategories.length > 0 && (
        <div className="border-b border-border/40 last:border-0 pb-2">
          <button
            type="button"
            onClick={() => toggleSubcat(OTHER_SECTION_KEY)}
            className="flex w-full items-center gap-2 py-2 text-left"
          >
            {expandedSubcats.has(OTHER_SECTION_KEY) || !!q ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("elementPicker.cloudOther")}
            </span>
            <span className="ml-auto text-[10px] font-mono text-muted-foreground tabular-nums">
              {otherCount}
            </span>
          </button>
          {(expandedSubcats.has(OTHER_SECTION_KEY) || !!q) &&
            otherCategories.map((cat) => (
              <CloudCategoryBlock
                key={cat.id}
                cat={cat}
                q={q}
                expanded={expandedSubcats.has(cat.id) || !!q}
                onToggle={() => toggleSubcat(cat.id)}
                onPick={onPick}
              />
            ))}
        </div>
      )}
    </div>
  );
}
