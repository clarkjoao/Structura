import { ChevronDown, ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { AwsCategory, AwsCategoryId } from "@/lib/catalogs/aws";
import { OTHER_AWS_SECTION_KEY } from "./constants";
import { AwsCategoryBlock } from "./AwsCategoryBlock";

export function AwsBrowseView({
  awsPrimaryCategories,
  awsOtherCategories,
  expandedAwsSubcats,
  q,
  toggleAwsSubcat,
  onPickAws,
}: {
  awsPrimaryCategories: AwsCategory[];
  awsOtherCategories: AwsCategory[];
  expandedAwsSubcats: Set<string>;
  q: string;
  toggleAwsSubcat: (catId: string) => void;
  onPickAws: (categoryId: AwsCategoryId, serviceId: string, serviceName: string) => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="space-y-1">
      {awsPrimaryCategories.map((cat) => (
        <AwsCategoryBlock
          key={cat.id}
          cat={cat}
          q={q}
          expanded={expandedAwsSubcats.has(cat.id) || !!q}
          onToggle={() => toggleAwsSubcat(cat.id)}
          onPickAws={onPickAws}
        />
      ))}
      {awsOtherCategories.length > 0 && (
        <div className="border-b border-border/40 last:border-0 pb-2">
          <button
            type="button"
            onClick={() => toggleAwsSubcat(OTHER_AWS_SECTION_KEY)}
            className="flex w-full items-center gap-2 py-2 text-left"
          >
            {expandedAwsSubcats.has(OTHER_AWS_SECTION_KEY) || !!q ? (
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            ) : (
              <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            )}
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {t("elementPicker.awsOther")}
            </span>
            <span className="ml-auto text-[10px] font-mono text-muted-foreground tabular-nums">
              {awsOtherCategories.reduce((n, c) => n + c.services.length, 0)}
            </span>
          </button>
          {(expandedAwsSubcats.has(OTHER_AWS_SECTION_KEY) || !!q) &&
            awsOtherCategories.map((cat) => (
              <AwsCategoryBlock
                key={cat.id}
                cat={cat}
                q={q}
                expanded={expandedAwsSubcats.has(cat.id) || !!q}
                onToggle={() => toggleAwsSubcat(cat.id)}
                onPickAws={onPickAws}
              />
            ))}
        </div>
      )}
    </div>
  );
}
