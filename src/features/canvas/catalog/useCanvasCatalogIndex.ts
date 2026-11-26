import { useMemo, useSyncExternalStore } from "react";
import { useTranslation } from "react-i18next";
import { useAllServices } from "@/features/diagram";
import { useElementPresetStore } from "@/features/element-presets";
import { elementsVersion, subscribeElements } from "@/features/elements/element.registry";
import { loadedLocalesKey, type CatalogEntry, type CatalogIndex } from "@/features/elements/search";
import { buildCanvasCatalogIndex, catalogEntriesById } from "./canvasCatalogIndex";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import { isKindActive, resolveKindPolicy } from "@/features/diagram-kinds/policy";
import { kindOffersElement } from "@/features/diagram-kinds/palette";

/**
 * The catalog index, rebuilt when the language, the services or the presets
 * change. Mount it only while a catalog surface is open: it subscribes to the
 * service list, and nothing else — typing in the catalog writes nothing.
 */
export function useCanvasCatalogIndex(): {
  index: CatalogIndex;
  byId: Map<string, CatalogEntry>;
} {
  const { i18n } = useTranslation();
  const services = useAllServices();
  const presetsMap = useElementPresetStore((state) => state.presets);
  // The active diagram's kind narrows what is offered (ADR-0014); the mode switches it back.
  const kindKey = useDiagramStore((state) => {
    const d = state.activeDiagramId ? state.diagrams[state.activeDiagramId] : undefined;
    const policy = resolveKindPolicy(d);
    return isKindActive(policy) ? policy.descriptor.id : "";
  });

  // Cross-locale terms come from every loaded bundle; the second one arrives in idle time.
  const loadedLocales = loadedLocalesKey();
  // A plugin may register an element pack while the catalog is open.
  const registryVersion = useSyncExternalStore(subscribeElements, elementsVersion);

  return useMemo(() => {
    const presets = Object.values(presetsMap).sort((a, b) => b.updatedAt - a.updatedAt);
    const kind = kindKey ? { kind: kindKey } : null;
    const index = buildCanvasCatalogIndex(
      services,
      presets,
      kind
        ? (entry) =>
            entry.insert.kind === "element" &&
            kindOffersElement(kind, {
              type: entry.insert.type,
              ...(entry.insert.createOptions.flowShape && {
                flowShape: entry.insert.createOptions.flowShape,
              }),
            })
        : undefined,
    );
    return { index, byId: catalogEntriesById(index) };
    // `i18n.language` is deliberate: labels are resolved when the index is built.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, presetsMap, i18n.language, loadedLocales, kindKey, registryVersion]);
}
