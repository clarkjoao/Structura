import type { ServiceDefinition } from "@/features/diagram";
import { foldText } from "./palette.search";
import type { PaletteGroup, PaletteItem, PaletteSuggestion } from "./palette.types";

/** What picking a service hands back. */
export interface ServiceRef {
  id: string;
}

const NO_SOURCE_GROUP_ID = "__manual__";

interface BuildOptions {
  sourceLabel: (source: string) => string;
  icon?: PaletteItem<ServiceRef>["icon"];
}

export interface ServiceLinkSource {
  items: PaletteItem<ServiceRef>[];
  groups: PaletteGroup[];
}

function sourceOf(service: ServiceDefinition): string {
  return service.sources?.[0]?.type ?? service.source ?? NO_SOURCE_GROUP_ID;
}

/** The palette's source for linking a service: the registry, by where each service came from. */
export function buildServiceLinkSource(
  services: readonly ServiceDefinition[],
  options: BuildOptions,
): ServiceLinkSource {
  const used = new Set<string>();
  const items = services
    .map((service): PaletteItem<ServiceRef> => {
      const source = sourceOf(service);
      used.add(source);
      return {
        id: service.id,
        label: service.name,
        // The owner rides on the second line: as a badge it ate the title of a long name.
        description:
          [service.technology.join(", "), service.owner].filter(Boolean).join(" · ") || undefined,
        groupIds: [source],
        icon: options.icon,
        keywords: [...service.technology, ...(service.tags ?? []), service.owner ?? ""].filter(
          Boolean,
        ),
        payload: { id: service.id },
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
  const groups = [...used]
    .map((id) => ({ id, label: options.sourceLabel(id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return { items, groups };
}

/** The service named like the element, if any, with why. Nothing for an empty name. */
export function suggestService(
  items: readonly PaletteItem<ServiceRef>[],
  elementName: string,
  reason: string,
): PaletteSuggestion<ServiceRef>[] {
  const wanted = foldText(elementName).trim();
  if (!wanted) return [];
  const match = items.find((item) => foldText(item.label).trim() === wanted);
  return match ? [{ item: match, reason }] : [];
}
