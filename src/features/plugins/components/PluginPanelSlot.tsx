import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useDiagramStore } from "@/features/diagram";
import type {
  PluginComponentPatch,
  PluginPanelContext,
  PluginPanelSlot as SlotId,
  PluginServicePatch,
} from "../plugin.types";
import { usePluginPanels } from "../use-plugin-contributions";
import { resolveLocalizedText } from "../localized-text";
import {
  sanitizeComponentPatch,
  sanitizeServicePatch,
  toComponentSnapshot,
  toServiceSnapshot,
} from "../snapshots";
import { PluginErrorBoundary } from "./PluginErrorBoundary";

interface PluginPanelSlotProps {
  slot: SlotId;
  /** Component ids the panel context exposes as `selection` (element-inspector slot). */
  selectionIds?: readonly string[];
  /** Service the panel context exposes as `service` (service-registry slot). */
  serviceId?: string | null;
}

/** Host slot rendering every plugin panel registered for it, each error-boundaried. */
export function PluginPanelSlot({
  slot,
  selectionIds = [],
  serviceId = null,
}: PluginPanelSlotProps) {
  const { t, i18n } = useTranslation();
  const panels = usePluginPanels(slot);

  const activeDiagram = useDiagramStore((state) =>
    state.activeDiagramId ? state.diagrams[state.activeDiagramId] : undefined,
  );
  const service = useDiagramStore((state) =>
    serviceId ? state.serviceCatalog[serviceId] : undefined,
  );
  const updateComponentAction = useDiagramStore((state) => state.updateComponent);
  const updateServiceAction = useDiagramStore((state) => state.updateService);

  const context: PluginPanelContext = useMemo(
    () => ({
      selection: selectionIds
        .map((id) => {
          const component = activeDiagram?.snapshot.components[id];
          return component ? toComponentSnapshot(component, activeDiagram?.nodeLayouts[id]) : null;
        })
        .filter((snapshot): snapshot is NonNullable<typeof snapshot> => snapshot !== null),
      service: service ? toServiceSnapshot(service) : null,
      updateComponent: (id: string, patch: PluginComponentPatch) => {
        // Sanctioned mutation: whitelisted fields through the store action (pushHistory inside).
        updateComponentAction(id, sanitizeComponentPatch(patch));
      },
      updateService: (id: string, patch: PluginServicePatch) => {
        updateServiceAction(id, sanitizeServicePatch(patch));
      },
      locale: i18n.language,
      // Inspector/service slots aren't edit-mode gated; toolbar overrides this per-slot.
      isEditMode: true,
    }),
    [
      activeDiagram,
      i18n.language,
      selectionIds,
      service,
      updateComponentAction,
      updateServiceAction,
    ],
  );

  if (panels.length === 0) return null;

  const crashFallback = (
    <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
      {t("plugins.panel.crashed")}
    </p>
  );

  return (
    <div className="flex flex-col gap-3">
      {panels.map((panel) => {
        const PanelComponent = panel.component;
        return (
          <section key={panel.id} className="rounded-lg border border-border bg-card p-3">
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {resolveLocalizedText(panel.title, i18n.language)}
            </h4>
            <PluginErrorBoundary label="panel" fallback={crashFallback}>
              <PanelComponent context={context} />
            </PluginErrorBoundary>
          </section>
        );
      })}
    </div>
  );
}
