import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** The icon column on the right edge that opens and closes the side panels. */
export function PanelRail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <nav
      aria-label={label}
      className="flex w-10 shrink-0 flex-col items-center gap-1 border-l border-border bg-card py-2"
    >
      {children}
    </nav>
  );
}

export interface PanelRailButtonProps {
  label: string;
  icon: ReactNode;
  active: boolean;
  disabled?: boolean;
  onClick: () => void;
}

export function PanelRailButton({ label, icon, active, disabled, onClick }: PanelRailButtonProps) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "relative flex h-8 w-8 items-center justify-center rounded-md transition-colors disabled:pointer-events-none disabled:opacity-50",
        active
          ? "bg-accent text-foreground before:absolute before:-right-1 before:top-1.5 before:h-5 before:w-0.5 before:rounded-full before:bg-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      {icon}
    </button>
  );
}
