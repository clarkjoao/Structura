import { COMPONENT_TYPE_NOTE, COMPONENT_TYPE_PANEL, PanelKind } from "@/features/diagram";
import {
  registryCatalogEntries,
  type CatalogEntry,
  type CatalogGroup,
} from "@/features/elements/search";
import { subscribeElements } from "@/features/elements/element.registry";
import i18n from "@/infrastructure/i18n";
import { KEY } from "@/lib/core/keyboard";

/** A one-click insert on the toolbar, with its plain-letter shortcut. */
export interface ToolbarTool {
  id: "note" | "panel" | "swimlane";
  /** The catalog entry it inserts (a palette entry key). */
  entryId: string;
  labelKey: string;
  key: string;
}

export const TOOLBAR_TOOLS: readonly ToolbarTool[] = [
  {
    id: "note",
    entryId: COMPONENT_TYPE_NOTE,
    labelKey: "elementCatalog.toolbar.note",
    key: KEY.N,
  },
  {
    id: "panel",
    entryId: `${COMPONENT_TYPE_PANEL}:${PanelKind.Default}`,
    labelKey: "elementCatalog.toolbar.panel",
    key: KEY.P,
  },
  {
    id: "swimlane",
    entryId: `${COMPONENT_TYPE_PANEL}:${PanelKind.Swimlane}`,
    labelKey: "elementCatalog.toolbar.swimlane",
    key: KEY.L,
  },
];

interface RegistryCatalog {
  groups: CatalogGroup[];
  entries: CatalogEntry[];
  byId: Map<string, CatalogEntry>;
}

let cached: { language: string; catalog: RegistryCatalog } | null = null;

// A plugin registering elements later must show up on the next read.
subscribeElements(() => {
  cached = null;
});

/**
 * The registry's catalog entries for the active language, built once per
 * language. For the toolbar and the shortcuts, which need a handful of entries
 * at any time and should not rebuild the index to get them.
 */
export function registryCatalog(): RegistryCatalog {
  if (cached?.language !== i18n.language) {
    const { groups, entries } = registryCatalogEntries();
    cached = {
      language: i18n.language,
      catalog: { groups, entries, byId: new Map(entries.map((entry) => [entry.id, entry])) },
    };
  }
  return cached.catalog;
}
