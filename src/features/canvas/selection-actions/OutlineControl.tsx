import { useEffect, useRef, useState } from "react";
import { SquareDashed } from "lucide-react";
import { cn } from "@/lib/utils";

export interface OutlineSection {
  /** Names the group of options, for assistive tech and the popover. */
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}

interface OutlineControlProps {
  /** The button's own label. */
  label: string;
  sections: readonly OutlineSection[];
}

/**
 * The floating toolbar's outline and fill: border style on a boundary, fill and stroke on a flow
 * element. These are appearance, so they live here and not in the side panel.
 */
export function OutlineControl({ label, sections }: OutlineControlProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (ref.current && !ref.current.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        title={label}
        aria-label={label}
        aria-expanded={open}
        onClick={(event) => {
          event.stopPropagation();
          setOpen((value) => !value);
        }}
        className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
      >
        <SquareDashed className="h-3.5 w-3.5" />
      </button>
      {open && (
        <div
          className="absolute left-0 top-full z-50 mt-1 min-w-40 space-y-2 rounded-md border border-border bg-card p-2 shadow-lg"
          onPointerDown={(event) => event.stopPropagation()}
        >
          {sections.map((section) => (
            <div key={section.label}>
              <span className="mb-1 block text-[11px] font-medium text-muted-foreground">
                {section.label}
              </span>
              <div role="radiogroup" aria-label={section.label} className="flex gap-1">
                {section.options.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    role="radio"
                    aria-checked={section.value === option.value}
                    onClick={(event) => {
                      event.stopPropagation();
                      section.onChange(option.value);
                    }}
                    className={cn(
                      "rounded px-2 py-1 text-xs transition-colors",
                      section.value === option.value
                        ? "bg-primary text-primary-foreground"
                        : "bg-secondary text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
