import type { LucideIcon } from "lucide-react";
import { Shapes } from "lucide-react";
import i18n from "@/infrastructure/i18n";
import { allElements } from "./element.registry";
import type { ElementDescriptor, ElementTypeId } from "./element.types";

/**
 * Palette entries derived from the registry.
 *
 * Both pickers build their own lists today; this is the single source they
 * concatenate with while the migration runs, so a migrated element is offered
 * by exactly one of the two paths.
 */
export interface ElementPaletteEntry {
  type: ElementTypeId;
  label: string;
  icon: LucideIcon;
  /** Extra words the search matches on, beyond the label. */
  searchKeys: string[];
  categoryId: string;
  spotlight?: number;
}

/** Stand-in for an element whose icon its family resolves (F4+). */
const FAMILY_ICON_PLACEHOLDER: LucideIcon = Shapes;

function toEntry(element: ElementDescriptor): ElementPaletteEntry {
  return {
    type: element.id,
    label: i18n.t(element.labelKey),
    icon:
      element.palette.icon.kind === "lucide" ? element.palette.icon.icon : FAMILY_ICON_PLACEHOLDER,
    searchKeys: [...element.palette.searchKeys],
    categoryId: element.palette.categoryId,
    spotlight: element.palette.spotlight,
  };
}

/** Registered elements offered in `categoryId`, label-resolved in the active locale. */
export function paletteEntriesForCategory(categoryId: string): ElementPaletteEntry[] {
  return allElements()
    .filter((element) => element.palette.categoryId === categoryId)
    .map(toEntry)
    .sort((a, b) => a.label.localeCompare(b.label));
}

/** True when the query matches the entry's label or one of its search keys. */
export function paletteEntryMatchesQuery(entry: ElementPaletteEntry, query: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  return entry.label.toLowerCase().includes(q) || entry.searchKeys.some((key) => key.includes(q));
}
