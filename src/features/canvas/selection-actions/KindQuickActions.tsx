import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Plus, Trash2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import type { KindActionGlyph } from "@/features/diagram-kinds/kind.types";
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
 * after it, move it across the axis, remove it); a step's lane is chosen in
 * the inspector's Journey tab. Renders nothing on a freehand diagram.
 */
export function KindQuickActions({ elementId }: { elementId: string }) {
  const diagram = useDiagramStore((state) =>
    state.activeDiagramId ? state.diagrams[state.activeDiagramId] : undefined,
  );
  if (!diagram) return null;
  const items = kindElementActionItems(diagram, elementId);
  if (items.length === 0) return null;
  const vertical = diagram.direction === "TB";
  // A step's lane is chosen in the inspector's kind tab (spec guided-editing-surfaces);
  // the floating bar keeps the lane's own icon actions.
  const glyphed = items.filter((item) => item.glyph);
  if (glyphed.length === 0) return null;

  return (
    <div
      className="mx-1 flex items-center gap-0.5 border-l border-border pl-1"
      data-testid="kind-quick-actions"
    >
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
