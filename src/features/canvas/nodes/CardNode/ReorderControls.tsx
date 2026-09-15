import { i18n } from "@/infrastructure/i18n";
import { HandleSide } from "@/features/canvas/enums";

export function buildReorderControls(
  connIds: string[],
  side: "incoming" | "outgoing",
  disabled: boolean,
  onReorderHandle: (
    side: "incoming" | "outgoing",
    connId: string,
    direction: "up" | "down",
  ) => void,
): React.ReactNode {
  const filtered = connIds.filter(Boolean);
  const n = filtered.length;
  if (n <= 1) return null;
  const posClass = side === HandleSide.Incoming ? "left-3" : "right-3";
  return filtered.map((connId, i) => {
    const topPct = ((i + 1) / (n + 1)) * 100;
    return (
      <div
        key={`reorder-${side}-${i}`}
        className={`absolute ${posClass} flex flex-col gap-px transition-opacity z-20 ${
          disabled
            ? "opacity-0 pointer-events-none"
            : "opacity-0 group-hover:opacity-100 pointer-events-none group-hover:pointer-events-auto"
        }`}
        style={{ top: `calc(${topPct}% - 10px)` }}
      >
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReorderHandle(side, connId, "up");
          }}
          disabled={disabled || i === 0}
          className="flex items-center justify-center w-3.5 h-3.5 text-[7px] rounded-sm bg-card/90 border border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          aria-label={i18n.t("reorderHandles.moveUp", { index: i + 1 })}
        >
          ↑
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation();
            onReorderHandle(side, connId, "down");
          }}
          disabled={disabled || i === n - 1}
          className="flex items-center justify-center w-3.5 h-3.5 text-[7px] rounded-sm bg-card/90 border border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground disabled:opacity-20 disabled:cursor-not-allowed transition-colors"
          aria-label={i18n.t("reorderHandles.moveDown", { index: i + 1 })}
        >
          ↓
        </button>
      </div>
    );
  });
}
