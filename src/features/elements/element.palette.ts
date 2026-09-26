import type { LucideIcon } from "lucide-react";
import { Shapes } from "lucide-react";
import i18n from "@/infrastructure/i18n";
import { offeredElements } from "./element.registry";
import type { ElementCreateOptions, ElementDescriptor, ElementTypeId } from "./element.types";

/**
 * Palette entries derived from the registry.
 *
 * Both pickers build their own lists today; this is the single source they
 * concatenate with while the migration runs, so a migrated element is offered
 * by exactly one of the two paths.
 */
export interface ElementPaletteEntry {
  /** Unique per entry, since one element may contribute several. */
  key: string;
  type: ElementTypeId;
  label: string;
  icon: LucideIcon;
  /** Extra words the search matches on, beyond the label. */
  searchKeys: string[];
  categoryId: string;
  spotlight?: number;
  /** What to create with when this entry is picked. */
  createOptions: ElementCreateOptions;
  /** Rendered instead of `icon` when present; see ElementPaletteVariant. */
  awsIconName?: string;
  /**
   * Family icon for `palette.icon: { kind: "family" }`.
   *
   * Pickers render this through the unified `CloudIcon` instead of the lucide
   * placeholder. Absent for lucide-backed entries.
   */
  familyIcon?: { familyId: string; iconName: string };
}

/** Stand-in for an element whose icon its family resolves (F4+). */
const FAMILY_ICON_PLACEHOLDER: LucideIcon = Shapes;

function iconOf(icon: ElementDescriptor["palette"]["icon"]): LucideIcon {
  return icon.kind === "lucide" ? icon.icon : FAMILY_ICON_PLACEHOLDER;
}

/** Every palette entry an element contributes: its variants, or itself. */
function entriesFor(element: ElementDescriptor): ElementPaletteEntry[] {
  const { palette } = element;

  if (palette.variants && palette.variants.length > 0) {
    return palette.variants.map((variant) => ({
      key: `${element.id}:${variant.id}`,
      type: element.id,
      label: i18n.t(variant.labelKey),
      icon: iconOf(variant.icon),
      searchKeys: [...(variant.searchKeys ?? palette.searchKeys)],
      categoryId: palette.categoryId,
      spotlight: palette.spotlight,
      createOptions: variant.createOptions,
      awsIconName: variant.awsIconName,
      familyIcon:
        variant.icon.kind === "family"
          ? { familyId: element.family, iconName: variant.icon.iconName }
          : undefined,
    }));
  }

  return [
    {
      key: element.id,
      type: element.id,
      label: i18n.t(element.labelKey),
      icon: iconOf(palette.icon),
      searchKeys: [...palette.searchKeys],
      categoryId: palette.categoryId,
      spotlight: palette.spotlight,
      createOptions: {},
      familyIcon:
        palette.icon.kind === "family"
          ? { familyId: element.family, iconName: palette.icon.iconName }
          : undefined,
    },
  ];
}

/**
 * Registered elements offered in `categoryId`, label-resolved in the active
 * locale. Sorted by label unless `order` is `"declared"`: a category whose
 * order carries meaning (the flowchart shapes, most-used first) keeps the order
 * its variants are declared in.
 */
export function paletteEntriesForCategory(
  categoryId: string,
  order: "label" | "declared" = "label",
): ElementPaletteEntry[] {
  const entries = offeredElements()
    .filter((element) => element.palette.categoryId === categoryId)
    .flatMap(entriesFor);
  return order === "declared" ? entries : entries.sort((a, b) => a.label.localeCompare(b.label));
}
