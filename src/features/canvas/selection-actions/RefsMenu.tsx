import { useEffect, useMemo } from "react";
import { ChevronDown, Eye, EyeOff, Link2, LocateFixed, Plus } from "lucide-react";
import { useTranslation } from "react-i18next";
import {
  getCachedCanvasSnapshot,
  useDiagramActions,
  useDiagramStore,
  useResolvedNodeLayouts,
  type Component,
} from "@/features/diagram";
import { refsOf, sharedMode, sharedUses } from "@/features/diagram/utils/shared";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { useSharedRevealStore } from "../shared/useSharedRevealStore";
import { useRefsMenuStore } from "./refsMenu.store";

/** The element's references and who uses it, from the active diagram. */
function useReferenceUsage(originalId: string) {
  const snapshot = useDiagramStore((state) => {
    const diagram = state.activeDiagramId ? state.diagrams[state.activeDiagramId] : undefined;
    return diagram ? getCachedCanvasSnapshot(diagram) : null;
  });
  return useMemo(() => {
    if (!snapshot) return { refs: [], consumers: [], connectionCount: 0 };
    const { components, connections } = snapshot;
    const uses = sharedUses(originalId, components, connections);
    const byConsumer = new Map<string, Set<string>>();
    for (const use of uses) {
      const protocols = byConsumer.get(use.consumerId) ?? new Set<string>();
      if (use.label.trim()) protocols.add(use.label.trim());
      byConsumer.set(use.consumerId, protocols);
    }
    return {
      refs: refsOf(originalId, components),
      consumers: [...byConsumer.entries()].map(([id, protocols]) => ({
        id,
        name: components[id]?.name ?? id,
        protocols: [...protocols],
      })),
      connectionCount: uses.length,
    };
  }, [snapshot, originalId]);
}

const SECTION_TITLE = "mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground";
const ROW_BUTTON =
  "flex w-full min-w-0 items-center gap-2 rounded px-1.5 py-1 text-left text-xs hover:bg-surface-hover";

/**
 * Everything about the element's references, in one labelled menu on its toolbar: make a new
 * reference, the references it already has, and who uses it.
 * Before, these were two bare icons and a popover that opened on hover over the canvas.
 */
export function RefsMenu({
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
  const openFor = useRefsMenuStore((state) => state.openFor);
  const setOpenFor = useRefsMenuStore((state) => state.setOpenFor);
  const revealed = useSharedRevealStore((state) => state.originals.has(component.id));
  const toggleReveal = useSharedRevealStore((state) => state.toggleOriginal);
  const { refs, consumers, connectionCount } = useReferenceUsage(component.id);
  const mode = sharedMode(component);
  const open = openFor === component.id;
  // Left open when the toolbar goes away (another selection), it would reopen by itself later.
  useEffect(
    () => () => {
      if (useRefsMenuStore.getState().openFor === component.id) setOpenFor(null);
    },
    [component.id, setOpenFor],
  );
  const shared = mode !== "edges" || refs.length > 0;

  const createRef = () => {
    const at = layouts[component.id];
    addSharedRef(
      component.id,
      component.parentId,
      at ? { x: at.x + (at.width ?? 200) + 40, y: at.y } : { x: 0, y: 0 },
    );
  };
  const focus = (id: string) => {
    setOpenFor(null);
    onFocusElement?.(id);
  };

  return (
    <Popover open={open} onOpenChange={(next) => setOpenFor(next ? component.id : null)}>
      <PopoverTrigger asChild>
        <button
          type="button"
          data-testid="refs-menu-trigger"
          className={cn(
            "flex h-6 items-center gap-1 rounded px-1.5 text-xs transition-colors hover:bg-surface-hover hover:text-foreground",
            shared ? "text-primary" : "text-muted-foreground",
          )}
          title={t("shared.menu.title")}
          aria-label={t("shared.menu.title")}
          aria-pressed={shared}
        >
          <Link2 className="h-3.5 w-3.5" aria-hidden />
          <span>{t("shared.menu.trigger")}</span>
          {refs.length > 0 && (
            <span className="font-mono text-[10px] text-muted-foreground">{refs.length}</span>
          )}
          <ChevronDown className="h-3 w-3 opacity-60" aria-hidden />
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-72 p-2"
        data-testid="refs-menu"
        onPointerDown={(event) => event.stopPropagation()}
      >
        <p className="px-1.5 pb-1 text-sm font-semibold">{t("shared.menu.title")}</p>
        <p className="px-1.5 pb-2 text-xs text-muted-foreground">{t("shared.menu.intro")}</p>

        {canCreate && (
          <button
            type="button"
            className={cn(ROW_BUTTON, "mb-2 border border-dashed border-border")}
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
          <div className="mb-2">
            <p className={SECTION_TITLE}>{t("shared.menu.existing", { count: refs.length })}</p>
            {refs.map((refId, index) => (
              <button key={refId} type="button" className={ROW_BUTTON} onClick={() => focus(refId)}>
                <LocateFixed className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                <span className="truncate">
                  {t("shared.menu.refRow", { name: component.name, index: index + 1 })}
                </span>
              </button>
            ))}
          </div>
        )}

        {consumers.length > 0 && (
          <div>
            <p className={SECTION_TITLE}>{t("shared.usedBy", { count: consumers.length })}</p>
            <ul className="max-h-40 overflow-y-auto">
              {consumers.map((consumer) => (
                <li key={consumer.id}>
                  <button type="button" className={ROW_BUTTON} onClick={() => focus(consumer.id)}>
                    <span className="min-w-0 flex-1 truncate">{consumer.name}</span>
                    <span className="shrink-0 truncate font-mono text-[10px] text-muted-foreground">
                      {consumer.protocols.join(", ")}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            {mode === "badge" && connectionCount > 0 && (
              <button
                type="button"
                aria-pressed={revealed}
                className={cn(ROW_BUTTON, "mt-1")}
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
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
