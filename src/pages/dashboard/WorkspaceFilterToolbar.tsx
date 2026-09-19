import { ArrowUpDown, LayoutGrid, List, Search } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { ContentFilter, ViewMode } from "@/pages/dashboard/dashboard.types";

interface WorkspaceFilterToolbarProps {
  contentFilter: ContentFilter;
  onContentFilterChange: (filter: ContentFilter) => void;
  globalSearch: string;
  onGlobalSearchChange: (value: string) => void;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onSort: (key: "name" | "updatedAt" | "level" | "domain") => void;
}

export function WorkspaceFilterToolbar({
  contentFilter,
  onContentFilterChange,
  globalSearch,
  onGlobalSearchChange,
  viewMode,
  onViewModeChange,
  onSort,
}: WorkspaceFilterToolbarProps) {
  const { t } = useTranslation();

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-1.5">
        <FilterChip
          active={contentFilter === "all"}
          label={t("common.all")}
          onClick={() => onContentFilterChange("all")}
        />
        <FilterChip
          active={contentFilter === "recent"}
          label={t("dashboard.filterRecent")}
          onClick={() => onContentFilterChange("recent")}
        />
        <FilterChip
          active={contentFilter === "favorites"}
          label={t("dashboard.filterFavorites")}
          onClick={() => onContentFilterChange("favorites")}
        />
      </div>

      <div className="flex items-center gap-1.5 self-end sm:self-auto">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder={t("dashboard.searchComponentPlaceholder")}
            value={globalSearch}
            onChange={(event) => onGlobalSearchChange(event.target.value)}
            className="h-7 w-48 rounded-md border border-border bg-secondary/50 pl-7 pr-3 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring"
          />
        </div>

        <div className="flex items-center rounded-md border border-border bg-secondary/50 p-0.5">
          <button
            type="button"
            onClick={() => onViewModeChange("grid")}
            className={cn(
              "rounded p-1 transition-colors",
              viewMode === "grid"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-label={t("dashboard.viewGrid")}
          >
            <LayoutGrid className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onViewModeChange("list")}
            className={cn(
              "rounded p-1 transition-colors",
              viewMode === "list"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
            aria-label={t("dashboard.viewList")}
          >
            <List className="h-3.5 w-3.5" />
          </button>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs text-muted-foreground">
              <ArrowUpDown className="h-3 w-3" />
              {t("common.sort")}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onSort("name")}>{t("common.name")}</DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSort("updatedAt")}>
              {t("common.lastEdited")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSort("level")}>
              {t("common.c4Level")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onSort("domain")}>
              {t("common.domain")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}

function FilterChip({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant={active ? "secondary" : "ghost"}
      size="sm"
      onClick={onClick}
      className={cn(
        "h-7 rounded-md px-2.5 text-xs",
        active ? "font-medium" : "text-muted-foreground",
      )}
    >
      {label}
    </Button>
  );
}
