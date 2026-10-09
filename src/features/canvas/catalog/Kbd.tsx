import { cn } from "@/lib/utils";

/** A key cap for keyboard hints. */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        "inline-flex min-w-[1.25rem] items-center justify-center rounded border border-border bg-muted px-1 font-mono text-[10px] leading-4 text-muted-foreground",
        className,
      )}
    >
      {children}
    </kbd>
  );
}
