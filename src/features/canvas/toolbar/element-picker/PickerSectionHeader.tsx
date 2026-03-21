import { ChevronRight } from "lucide-react";

interface PickerSectionHeaderProps {
  sectionLabel: string;
  showViewAll?: boolean;
  viewAllLabel?: string;
  onViewAll?: () => void;
}

export function PickerSectionHeader({
  sectionLabel,
  showViewAll,
  viewAllLabel,
  onViewAll,
}: PickerSectionHeaderProps) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <span className="text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
        {sectionLabel}
      </span>
      <div className="h-px flex-1 bg-border" />
      {showViewAll && onViewAll && viewAllLabel ? (
        <button
          type="button"
          onClick={onViewAll}
          className="flex shrink-0 items-center gap-0.5 text-[11px] text-primary hover:underline"
        >
          {viewAllLabel}
          <ChevronRight className="h-3 w-3" />
        </button>
      ) : null}
    </div>
  );
}
