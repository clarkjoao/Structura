import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useAllServices } from "@/features/diagram";
import { useElementPresetStore } from "@/features/element-presets";
import type { CatalogEntry, CatalogIndex } from "@/features/elements/search";
import { buildCanvasCatalogIndex, catalogEntriesById } from "./canvasCatalogIndex";

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

  return useMemo(() => {
    const presets = Object.values(presetsMap).sort((a, b) => b.updatedAt - a.updatedAt);
    const index = buildCanvasCatalogIndex(services, presets);
    return { index, byId: catalogEntriesById(index) };
    // `i18n.language` is deliberate: labels are resolved when the index is built.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, presetsMap, i18n.language]);
}
