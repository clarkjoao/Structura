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

export type ViewMode = "grid" | "list";

export interface FilterChipOption<F extends string> {
  value: F;
  label: string;
}

export interface SortOption<K extends string> {
  key: K;
  label: string;
}

export interface LibraryFilterToolbarProps<F extends string, K extends string> {
  /** The narrowing chips, in the order they appear. Labels arrive translated. */
  chips: readonly FilterChipOption<F>[];
  activeChip: F;
  onChipChange: (value: F) => void;
  search: string;
  onSearchChange: (value: string) => void;
  searchPlaceholder: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  /** The orderings this library can be sorted by. Labels arrive translated. */
  sortOptions: readonly SortOption<K>[];
  onSort: (key: K) => void;
}

/**
 * The narrowing controls above a library listing: chips, search, view toggle
 * and sort, shared by the diagram workspace and the walkthrough library.
 *
 * Both libraries narrow the same way; what differs is only *what* they narrow
 * by — a diagram sorts by C4 level, a walkthrough by how many scenes it has —
 * so the chip set and the sort orderings arrive as props, already translated by
 * the host that knows what they mean.
 */
export function LibraryFilterToolbar<F extends string, K extends string>({
  chips,
  activeChip,
  onChipChange,
  search,
  onSearchChange,
  searchPlaceholder,
  viewMode,
  onViewModeChange,
  sortOptions,
  onSort,
}: LibraryFilterToolbarProps<F, K>) {
  const { t } = useTranslation();

  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex flex-wrap items-center gap-1.5">
        {chips.map((chip) => (
          <FilterChip
            key={chip.value}
            active={activeChip === chip.value}
            label={chip.label}
            onClick={() => onChipChange(chip.value)}
          />
        ))}
      </div>

      <div className="flex items-center gap-1.5 self-end sm:self-auto">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <input
            type="search"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(event) => onSearchChange(event.target.value)}
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
            {sortOptions.map((option) => (
              <DropdownMenuItem key={option.key} onClick={() => onSort(option.key)}>
                {option.label}
              </DropdownMenuItem>
            ))}
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
