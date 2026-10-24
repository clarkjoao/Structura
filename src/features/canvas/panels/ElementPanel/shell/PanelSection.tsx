import { useState, type ReactNode } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface PanelSectionProps {
  title: string;
  /** Short text beside the title while folded ("3 tags"). */
  summary?: string;
  defaultOpen?: boolean;
  children: ReactNode;
}

/** A collapsible group of fields. Bodies run what it is → how it relates → metadata. */
export function PanelSection({ title, summary, defaultOpen = true, children }: PanelSectionProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-border last:border-b-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-1.5 px-4 py-2.5 text-left text-xs font-semibold text-foreground hover:bg-accent/40"
      >
        <ChevronRight
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform",
            open && "rotate-90",
          )}
        />
        <span className="flex-1">{title}</span>
        {!open && summary && (
          <span className="truncate text-[11px] font-normal text-muted-foreground">{summary}</span>
        )}
      </button>
      {open && <div className="space-y-3 px-4 pb-4">{children}</div>}
    </section>
  );
}
