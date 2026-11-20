import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Plus, Rows3, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import type { KindActionGlyph } from "@/features/diagram-kinds/kind.types";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { kindElementActionItems } from "../chrome/kindElementActions";

const BUTTON_CLASS =
  "flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground";

function glyphIcon(glyph: KindActionGlyph, vertical: boolean): LucideIcon {
  switch (glyph) {
    case "add":
      return Plus;
    case "before":
      return vertical ? ArrowLeft : ArrowUp;
    case "after":
      return vertical ? ArrowRight : ArrowDown;
    case "remove":
      return Trash2;
  }
}

/**
 * The active kind's actions on the selected element, in its floating bar
 * (ADR-0014) — where the eye already is. A lane gets icon buttons (add one
 * after it, move it across the axis, remove it); a step gets "move to lane",
 * listing the other lanes by name. Renders nothing on a freehand diagram.
 */
export function KindQuickActions({ elementId }: { elementId: string }) {
  const { t } = useTranslation();
  const diagram = useDiagramStore((state) =>
    state.activeDiagramId ? state.diagrams[state.activeDiagramId] : undefined,
  );
  if (!diagram) return null;
  const items = kindElementActionItems(diagram, elementId);
  if (items.length === 0) return null;
  const vertical = diagram.direction === "TB";
  const moveTo = items.filter((item) => item.group === "moveTo");
  const glyphed = items.filter((item) => item.group !== "moveTo" && item.glyph);

  return (
    <div
      className="mx-1 flex items-center gap-0.5 border-l border-border pl-1"
      data-testid="kind-quick-actions"
    >
      {moveTo.length > 0 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex h-6 items-center gap-1 rounded px-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
              title={t("diagramKinds.guided.lanes.moveTo")}
              aria-label={t("diagramKinds.guided.lanes.moveTo")}
            >
              <Rows3 className={cn("h-3.5 w-3.5", vertical && "rotate-90")} aria-hidden />
              {t("diagramKinds.guided.lanes.field")}
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" onPointerDown={(e) => e.stopPropagation()}>
            <DropdownMenuLabel>{t("diagramKinds.guided.lanes.moveTo")}</DropdownMenuLabel>
            {moveTo.map((item) => (
              <DropdownMenuItem key={item.id} onSelect={item.onSelect}>
                {item.label}
              </DropdownMenuItem>
            ))}
            {/* The same move from the keyboard, to the lane before or after. */}
            <p className="px-2 pb-1 pt-1.5 font-mono text-[11px] text-muted-foreground">
              {vertical ? "Alt + ← / →" : "Alt + ↑ / ↓"}
            </p>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
      {glyphed.map((item) => {
        const Icon = glyphIcon(item.glyph!, vertical);
        return (
          <button
            key={item.id}
            type="button"
            title={item.label}
            aria-label={item.label}
            onClick={item.onSelect}
            className={cn(BUTTON_CLASS, item.danger && "hover:text-destructive")}
          >
            <Icon className="h-3.5 w-3.5" aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
