import { Tag } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
export interface LayerFilterPopoverProps {
  allTags: string[];
  /** null means "no tag filter active" (all tags visible). */
  visibleTags: Set<string> | null;
  versionsPickerLocked?: boolean;
  onToggle: (tag: string) => void;
  onShowAll: () => void;
  onShowNoTags: () => void;
  /** Trigger classes, so the host toolbar can style it like its other buttons. */
  className?: string;
  onOpenChange?: (open: boolean) => void;
}

export function LayerFilterPopover({
  allTags,
  visibleTags,
  versionsPickerLocked,
  onToggle,
  onShowAll,
  onShowNoTags,
  className,
  onOpenChange,
}: LayerFilterPopoverProps) {
  const { t } = useTranslation();
  const noTags = allTags.length === 0;

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>
        <button
          type="button"
          disabled={noTags || versionsPickerLocked}
          aria-label={t("canvas.toolbar.filterByTag")}
          title={
            noTags
              ? t("canvas.toolbar.noTags")
              : versionsPickerLocked
                ? t("diagramNav.unavailableWhileRecordingOrPlayback")
                : t("canvas.toolbar.filterByTag")
          }
          className={cn(
            "relative",
            className,
            (noTags || versionsPickerLocked) && "opacity-50 pointer-events-none",
          )}
        >
          <Tag className="h-4 w-4 shrink-0" aria-hidden />

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
      <PopoverContent side="top" align="center" className="w-72 p-3">
        <ul className="flex max-h-[min(50vh,280px)] flex-col gap-2 overflow-y-auto pr-1">
          <li>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <Checkbox checked={visibleTags === null} onCheckedChange={onShowAll} />
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
