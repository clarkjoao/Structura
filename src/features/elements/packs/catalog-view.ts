/**
 * The legacy catalog shape (`AWS_CATEGORIES`, `GCP_CATEGORIES`, …) read from a pack's JSON.
 *
 * The catalog modules are leaves: domain guards, the LLM IR (which must read static data, never
 * the registry) and draw.io import depend on them, so this imports nothing — no schema, no
 * i18n. The pack itself is validated where it registers and by `builtin-packs.test.ts`.
 */

/** The fields of a pack JSON a catalog view reads. */
export interface PackJsonCatalog {
  readonly categories: readonly {
    readonly id: string;
    readonly label: { readonly en: string };
    readonly vendorName?: string;
  }[];
  readonly services: readonly {
    readonly id: string;
    readonly name: string;
    readonly category: string;
    readonly icon: string;
  }[];
}

export interface CatalogViewService {
  id: string;
  name: string;
  iconName: string;
}

export interface CatalogViewCategory<C extends string> {
  id: C;
  /** The vendor's name for the category, else its English label. */
  name: string;
  services: CatalogViewService[];
}

/**
 * Categories in pack order, each with its services in pack order. Throws when a category id is
 * not one the family's guard accepts — the TS id union and the pack must agree.
 */
export function catalogView<C extends string>(
  pack: PackJsonCatalog,
  isCategory: (id: string) => id is C,
): CatalogViewCategory<C>[] {
  return pack.categories.map((category) => {
    const { id } = category;
    if (!isCategory(id)) {
      throw new Error(`[element-packs] category "${id}" is not in its family's id union.`);
    }
    return {
      id,
      name: category.vendorName ?? category.label.en,
      services: pack.services
        .filter((service) => service.category === id)
        .map((service) => ({ id: service.id, name: service.name, iconName: service.icon })),
    };
  });
}
