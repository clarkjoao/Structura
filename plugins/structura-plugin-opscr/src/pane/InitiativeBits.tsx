import type { PluginVersionStatus } from "../types/plugin.types";

// Small pieces the Overview and the Initiatives tab share: an initiative's status and its counts.

const STATUS_DOT: Record<PluginVersionStatus, string> = {
  proposed: "bg-slate-400",
  approved: "bg-sky-500",
  "in-progress": "bg-emerald-500",
  done: "bg-violet-500",
};

/** The status as a coloured dot, as the Version panel draws it. */
export function StatusDot({ status }: { status: PluginVersionStatus | null }) {
  return (
    <span
      aria-hidden
      className={`inline-block h-2 w-2 shrink-0 rounded-full ${status ? STATUS_DOT[status] : "bg-border"}`}
    />
  );
}

/** What an initiative adds, changes and retires, as `+3 ~1 −2` (zeros left out). */
export function ChangeCounts({
  added,
  modified,
  retired,
  edges = 0,
}: {
  added: number;
  modified: number;
  retired: number;
  edges?: number;
}) {
  const parts: Array<[string, number, string]> = [
    ["+", added, "text-green-700 dark:text-green-400"],
    ["~", modified, "text-amber-700 dark:text-amber-400"],
    ["−", retired, "text-red-700 dark:text-red-400"],
  ];
  const shown = parts.filter(([, n]) => n > 0);
  return (
    <span className="inline-flex shrink-0 gap-1 font-mono text-[10px]">
      {shown.map(([sign, n, tone]) => (
        <span key={sign} className={tone}>
          {sign}
          {n}
        </span>
      ))}
      {shown.length === 0 && edges > 0 && <span className="text-muted-foreground">⇄{edges}</span>}
    </span>
  );
}
