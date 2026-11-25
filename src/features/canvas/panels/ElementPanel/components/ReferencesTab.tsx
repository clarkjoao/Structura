import { Eye, EyeOff, LocateFixed, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useDiagramActions, useResolvedNodeLayouts, type Component } from "@/features/diagram";
import { sharedMode } from "@/features/diagram/utils/shared";
import { cn } from "@/lib/utils";
import { useReferenceUsage } from "@/features/canvas/shared/useReferenceUsage";
import { useSharedRevealStore } from "@/features/canvas/shared/useSharedRevealStore";
import { PanelSection } from "../shell";

const ROW_BUTTON =
  "flex w-full min-w-0 items-center gap-2 rounded px-1.5 py-1 text-left text-sm hover:bg-accent";

/**
 * The element's references in the inspector: make one beside it, the ones it has, and who uses
 * it. Each row leads to the element it names.
 */
export function ReferencesTab({
  component,
  canCreate,
  onFocusElement,
}: {
  component: Component;
  /** Whether this element can have references (`canBeReferenced`). */
  canCreate: boolean;
  onFocusElement?: (componentId: string) => void;
}) {
  const { t } = useTranslation();
  const layouts = useResolvedNodeLayouts();
  const { addSharedRef } = useDiagramActions();
  const revealed = useSharedRevealStore((state) => state.originals.has(component.id));
  const toggleReveal = useSharedRevealStore((state) => state.toggleOriginal);
  const { refs, consumers, connectionCount } = useReferenceUsage(component.id);

  const createRef = () => {
    const at = layouts[component.id];
    addSharedRef(
      component.id,
      component.parentId,
      at ? { x: at.x + (at.width ?? 200) + 40, y: at.y } : { x: 0, y: 0 },
    );
  };

  return (
    <div className="min-h-0 flex-1 overflow-y-auto" data-testid="references-tab">
      <PanelSection title={t("shared.menu.title")}>
        <p className="text-xs text-muted-foreground">{t("shared.menu.intro")}</p>
        {canCreate && (
          <button
            type="button"
            className={cn(ROW_BUTTON, "border border-dashed border-border")}
            onClick={createRef}
          >
            <Plus className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block">{t("shared.menu.create")}</span>
              <span className="block text-[11px] text-muted-foreground">
                {t("shared.menu.createHint")}
              </span>
            </span>
          </button>
        )}
        {refs.length > 0 && (
          <ul>
            {refs.map((refId, index) => (
              <li key={refId}>
                <button
                  type="button"
                  className={ROW_BUTTON}
                  disabled={!onFocusElement}
                  onClick={() => onFocusElement?.(refId)}
                >
                  <LocateFixed className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="truncate">
                    {t("shared.menu.refRow", { name: component.name, index: index + 1 })}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </PanelSection>

      <PanelSection title={t("shared.usedBy", { count: consumers.length })}>
        {consumers.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("shared.menu.noConsumers")}</p>
        ) : (
          <ul>
            {consumers.map((consumer) => (
              <li key={consumer.id}>
                <button
                  type="button"
                  className={ROW_BUTTON}
                  disabled={!onFocusElement}
                  onClick={() => onFocusElement?.(consumer.id)}
                >
                  <span className="min-w-0 flex-1 truncate">{consumer.name}</span>
                  <span className="shrink-0 truncate font-mono text-[10px] text-muted-foreground">
                    {consumer.protocols.join(", ")}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        )}
        {sharedMode(component) === "badge" && connectionCount > 0 && (
          <button
            type="button"
            aria-pressed={revealed}
            className={ROW_BUTTON}
            onClick={() => toggleReveal(component.id)}
          >
            {revealed ? (
              <EyeOff className="h-3.5 w-3.5 shrink-0" aria-hidden />
            ) : (
              <Eye className="h-3.5 w-3.5 shrink-0" aria-hidden />
            )}
            {revealed
              ? t("shared.hideEdges", { count: connectionCount })
              : t("shared.showEdges", { count: connectionCount })}
          </button>
        )}
      </PanelSection>
    </div>
  );
}
