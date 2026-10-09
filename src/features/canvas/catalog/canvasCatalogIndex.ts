import { Bookmark, Server } from "lucide-react";
import i18n from "@/infrastructure/i18n";
import type { ServiceDefinition } from "@/features/diagram";
import type { ElementPreset } from "@/features/element-presets";
import { getElement } from "@/features/elements/element.registry";
import {
  createCatalogIndex,
  registryCatalogEntries,
  type CatalogEntry,
  type CatalogIndex,
} from "@/features/elements/search";

/** The diagram's business services: inserted as a linked `system`. */
export const CATALOG_SERVICES_GROUP_ID = "services";
/** The user's saved presets. */
export const CATALOG_PRESETS_GROUP_ID = "presets";

function serviceEntry(service: ServiceDefinition): CatalogEntry {
  return {
    id: `service:${service.id}`,
    groupId: CATALOG_SERVICES_GROUP_ID,
    label: service.name,
    description: service.description || service.technology.join(", "),
    synonyms: service.technology,
    tags: service.tags ?? [],
    icon: Server,
    insert: { kind: "service", serviceId: service.id },
  };
}

function presetEntry(preset: ElementPreset): CatalogEntry {
  const base = getElement(preset.baseType);
  const icon = base?.palette.icon.kind === "lucide" ? base.palette.icon.icon : Bookmark;
  return {
    id: `preset:${preset.id}`,
    groupId: CATALOG_PRESETS_GROUP_ID,
    label: preset.name,
    description: preset.description ?? "",
    synonyms: base ? [i18n.t(base.labelKey)] : [],
    tags: [],
    icon,
    insert: { kind: "preset", presetId: preset.id },
  };
}

/**
 * Everything the catalog offers on the canvas: the element registry, then the
 * diagram's services and the user's presets. Label-resolved in the active
 * locale — rebuild on a language change.
 */
export function buildCanvasCatalogIndex(
  services: readonly ServiceDefinition[],
  presets: readonly ElementPreset[],
): CatalogIndex {
  const registry = registryCatalogEntries();
  return createCatalogIndex(
    [
      ...registry.groups,
      {
        id: CATALOG_SERVICES_GROUP_ID,
        label: i18n.t(`elementCatalog.groups.${CATALOG_SERVICES_GROUP_ID}`),
      },
      {
        id: CATALOG_PRESETS_GROUP_ID,
        label: i18n.t(`elementCatalog.groups.${CATALOG_PRESETS_GROUP_ID}`),
      },
    ],
    [...registry.entries, ...services.map(serviceEntry), ...presets.map(presetEntry)],
  );
}

/** Entries by id, for recents and drops that carry only the id. */
export function catalogEntriesById(index: CatalogIndex): Map<string, CatalogEntry> {
  return new Map(index.entries.map((entry) => [entry.id, entry]));
}
