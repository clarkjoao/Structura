import { cn } from "@/lib/utils";
import type { CategoryNavItem } from "./buildCategoryNav";
import { ElementCategory } from "../../enums";

export function CategorySidebar({
  items,
  activeCategory,
  q,
  setCategory,
}: {
  items: CategoryNavItem[];
  activeCategory: ElementCategory;
  q: string;
  setCategory: (c: ElementCategory) => void;
}) {
  return (
    <aside className="flex w-[160px] shrink-0 flex-col border-r border-border bg-muted/40 py-2">
      {items.map((item) => {
        const Icon = item.icon;
        const active = !q && activeCategory === item.id;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => setCategory(item.id)}
            className={cn(
              "flex h-10 w-full items-center gap-2 px-3 text-left text-sm transition-colors",
              active
                ? "border-r-2 border-primary bg-primary/10 font-medium text-primary"
                : "border-r-2 border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            <span className="shrink-0 rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-mono tabular-nums text-muted-foreground">
              {item.count}
            </span>
          </button>
        );
      })}
    </aside>
  );
}
