import { Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
export interface LayerFilterPopoverProps {
  allTags: string[];
  /** null means "no tag filter active" (all tags visible). */
  visibleTags: Set<string> | null;
  scenesPickerLocked?: boolean;
  onToggle: (tag: string) => void;
  onShowAll: () => void;
  onShowNoTags: () => void;
}

export function LayerFilterPopover({
  allTags,
  visibleTags,
  scenesPickerLocked,
  onToggle,
  onShowAll,
  onShowNoTags,
}: LayerFilterPopoverProps) {
  const { t } = useTranslation();
  const noTags = allTags.length === 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={noTags || scenesPickerLocked}
          title={
            noTags
              ? t("canvas.toolbar.noTags")
              : scenesPickerLocked
                ? t("diagramNav.unavailableWhileRecordingOrPlayback")
                : t("canvas.toolbar.filterByTag")
          }
          className={cn(
            "relative flex items-center gap-1.5 rounded-lg border border-border bg-card/90 backdrop-blur-sm px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-surface-hover transition-colors",
            (noTags || scenesPickerLocked) && "opacity-50 pointer-events-none",
          )}
        >
          <Tag className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t("canvas.toolbar.filterByTag")}
          {visibleTags !== null && visibleTags.size > 0 ? (
            <span
              className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[9px] font-medium text-primary-foreground"
              aria-hidden
            >
              {visibleTags.size}
            </span>
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <ul className="flex max-h-[min(50vh,280px)] flex-col gap-2 overflow-y-auto pr-1">
          <li>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox
                checked={visibleTags === null}
                onCheckedChange={onShowAll}
              />
              <span>{t("canvas.toolbar.allTags")}</span>
            </label>
          </li>

          <li>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox
                checked={visibleTags !== null && visibleTags.size === 0}
                onCheckedChange={onShowNoTags}
              />
              <span>{t("canvas.toolbar.noTagsFilter")}</span>
            </label>
          </li>
         {allTags.map((tag) => (
            <li key={tag}>
              <label className="flex cursor-pointer items-center gap-2 text-xs">
                <Checkbox
                  checked={visibleTags === null || visibleTags.has(tag)}
                  onCheckedChange={() => onToggle(tag)}
                />
                <span className="truncate">{tag}</span>
              </label>
            </li>
          ))}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
