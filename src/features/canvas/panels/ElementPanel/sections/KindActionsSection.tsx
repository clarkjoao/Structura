import { useTranslation } from "react-i18next";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { cn } from "@/lib/utils";
import { kindElementActionItems } from "../../../chrome/kindElementActions";

/**
 * The active diagram kind's actions on the selected element (ADR-0014), in the
 * inspector: for a guided step, the lane it moves to; for a lane, adding,
 * moving and removing lanes. Renders nothing when the kind offers none.
 */
export function KindActionsSection({ elementId }: { elementId: string }) {
  const { t } = useTranslation();
  const diagram = useDiagramStore((state) =>
    state.activeDiagramId ? state.diagrams[state.activeDiagramId] : undefined,
  );
  if (!diagram) return null;
  const items = kindElementActionItems(diagram, elementId);
  if (items.length === 0) return null;
  const moveTo = items.filter((item) => item.group === "moveTo");
  const lane = items.filter((item) => item.group === "lane");

  return (
    <div className="shrink-0 border-b border-border px-3 py-2" data-testid="kind-actions">
      {moveTo.length > 0 && (
        <>
          <p className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {t("diagramKinds.guided.lanes.moveTo")}
          </p>
          <div
            className="flex flex-wrap gap-1"
            role="group"
            aria-label={t("diagramKinds.guided.lanes.field")}
          >
            {moveTo.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onSelect}
                className="rounded-md border border-border px-2 py-0.5 text-xs text-foreground hover:bg-muted"
              >
                {item.label}
              </button>
            ))}
          </div>
        </>
      )}
      {lane.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {lane.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={item.onSelect}
              className={cn(
                "rounded-md border border-border px-2 py-0.5 text-xs hover:bg-muted",
                item.danger ? "text-destructive" : "text-foreground",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
