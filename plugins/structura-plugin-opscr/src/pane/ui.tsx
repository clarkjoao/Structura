import { useState, type ReactNode } from "react";

// The pane's components, drawn like the host's inspector (see `styles.ts`).

const CHEVRON_RIGHT = "m9 18 6-6-6-6";

/** A collapsible group, as the inspector's sections. */
export function Section({
  title,
  defaultOpen = true,
  children,
}: {
  title: string;
  defaultOpen?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <section className="border-b border-border">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center gap-1.5 px-4 py-2.5 text-left text-xs font-semibold text-foreground hover:bg-accent/40"
      >
        <Icon
          path={CHEVRON_RIGHT}
          className={`h-3.5 w-3.5 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-90" : ""}`}
        />
        <span className="min-w-0 flex-1 truncate">{title}</span>
      </button>
      {open && <div className="space-y-3 px-4 pb-4">{children}</div>}
    </section>
  );
}

export function Icon({
  path,
  className = "h-3.5 w-3.5",
}: {
  path: string | string[];
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
    >
      {(Array.isArray(path) ? path : [path]).map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}
