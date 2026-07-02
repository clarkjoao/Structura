import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import AwsIcon from "@/features/canvas/nodes/AwsIcon";
import { AWS_CATEGORIES, AWS_SERVICE_MAP, type AwsService } from "@/lib/catalogs/aws";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

const AWS_PICKER_RESULT_LIMIT = 60;
const ICON_PREVIEW_SIZE = 24;

const ALL_CATEGORIES_VALUE = "all";

const allAwsServices = [...AWS_SERVICE_MAP.values()];

interface AwsIconPickerCardProps {
  service: AwsService;
  onSelect: (iconName: string) => void;
}

function AwsIconPickerCard({ service, onSelect }: AwsIconPickerCardProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(service.iconName)}
      className={cn(
        "flex flex-col items-center gap-1 rounded-lg border border-border p-2 text-center transition-colors hover:bg-accent",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      )}
      aria-label={service.name}
    >
      <div
        className="flex shrink-0 items-center justify-center"
        style={{ width: ICON_PREVIEW_SIZE, height: ICON_PREVIEW_SIZE }}
      >
        <AwsIcon iconName={service.iconName} size={ICON_PREVIEW_SIZE} className="shrink-0" />
      </div>
      <span
        className="line-clamp-2 w-full break-words text-muted-foreground"
        style={{ fontSize: 10 }}
      >
        {service.name}
      </span>
    </button>
  );
}

export interface AwsIconPickerPanelProps {
  onSelect: (iconName: string) => void;
}

export function AwsIconPickerPanel({ onSelect }: AwsIconPickerPanelProps) {
  const { t } = useTranslation();
  const [categoryFilter, setCategoryFilter] = useState<string>(ALL_CATEGORIES_VALUE);
  const [searchQuery, setSearchQuery] = useState("");

  const servicesInCategory = useMemo(() => {
    if (categoryFilter === ALL_CATEGORIES_VALUE) {
      return allAwsServices;
    }
    return allAwsServices.filter((service) => service.categoryId === categoryFilter);
  }, [categoryFilter]);

  const visibleServices = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    const matched = query
      ? servicesInCategory.filter(
          (service) =>
            service.name.toLowerCase().includes(query) ||
            service.iconName.toLowerCase().includes(query) ||
            service.id.toLowerCase().includes(query),
        )
      : servicesInCategory;
    return matched.slice(0, AWS_PICKER_RESULT_LIMIT);
  }, [searchQuery, servicesInCategory]);

  return (
    <div className="flex flex-col gap-3">
      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
        <SelectTrigger>
          <SelectValue placeholder={t("icons.aws.allCategories")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL_CATEGORIES_VALUE}>{t("icons.aws.allCategories")}</SelectItem>
          {AWS_CATEGORIES.map((category) => (
            <SelectItem key={category.id} value={category.id}>
              {category.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="search"
        value={searchQuery}
        onChange={(event) => setSearchQuery(event.target.value)}
        placeholder={t("icons.aws.searchPlaceholder")}
        aria-label={t("icons.aws.searchPlaceholder")}
      />
      {visibleServices.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">{t("icons.emptyLibrary")}</p>
      ) : (
        <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-5">
          {visibleServices.map((service) => (
            <AwsIconPickerCard key={service.id} service={service} onSelect={onSelect} />
          ))}
        </div>
      )}
    </div>
  );
}
