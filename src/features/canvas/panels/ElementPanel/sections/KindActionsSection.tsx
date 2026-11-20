import { useTranslation } from "react-i18next";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { kindElementActionItems } from "../../../chrome/kindElementActions";

/**
 * The active diagram kind's "move to" actions on the selected element
 * (ADR-0014), in the inspector: for a guided step, the lanes it can move to.
 * A lane's own actions (add, move, remove) sit in its floating bar on the
 * canvas (`KindQuickActions`). Renders nothing when the kind offers none.
 */
export function KindActionsSection({ elementId }: { elementId: string }) {
  const { t } = useTranslation();
  const diagram = useDiagramStore((state) =>
    state.activeDiagramId ? state.diagrams[state.activeDiagramId] : undefined,
  );
  if (!diagram) return null;
  const items = kindElementActionItems(diagram, elementId);
  const moveTo = items.filter((item) => item.group === "moveTo");
  if (moveTo.length === 0) return null;

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
    </div>
  );
}
