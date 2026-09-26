import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

interface SegmentedControlProps<T extends string> {
  label: string;
  value: T;
  options: readonly SegmentedOption<T>[];
  onChange: (value: T) => void;
}

/**
 * One choice out of a few, shown side by side — a radio group drawn with the
 * design system's `Button`, checked the same way the inspector's other
 * either/or choices are (primary border over a primary wash).
 */
export function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div>
      <p className="text-[11px] text-muted-foreground uppercase tracking-wider font-semibold mb-1.5">
        {label}
      </p>
      <div role="radiogroup" aria-label={label} className="flex gap-1.5">
        {options.map((option) => {
          const checked = option.value === value;
          return (
            <Button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={checked}
              variant="outline"
              size="sm"
              onClick={() => onChange(option.value)}
              className={cn(
                "h-8 flex-1 px-2 text-xs",
                checked
                  ? "border-primary bg-primary/10 text-foreground hover:bg-primary/10"
                  : "bg-secondary text-muted-foreground hover:text-foreground",
              )}
            >
              {option.label}
            </Button>
          );
        })}
      </div>
    </div>
  );
}
