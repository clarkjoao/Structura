import type { ElementDescriptor, ElementPaletteVariant } from "../element.types";
import type { CloudFamilyDefinition, CloudFamilyService } from "./cloud-family.types";
import { rememberFamilyIconResolver } from "./family-icon-resolvers";

function fail(familyId: string, reason: string): never {
  throw new Error(
    `[elements] Cannot build cloud family "${familyId}": ${reason}. Expected a CloudFamilyDefinition with categories[] and services[] whose categoryId values match.`,
  );
}

function servicesForCategory(
  services: readonly CloudFamilyService[],
  categoryId: string,
): CloudFamilyService[] {
  return services.filter((service) => service.categoryId === categoryId);
}

function paletteVariantsFor(
  services: readonly CloudFamilyService[],
): ElementPaletteVariant[] | undefined {
  if (services.length === 0) return undefined;

  return services.map((service) => ({
    id: service.id,
    // Proper nouns: see CloudFamilyService.name. i18n returns the key when
    // there is no entry, which is the visible name we want.
    labelKey: service.name,
    icon: { kind: "family" as const, iconName: service.iconName },
    createOptions: { serviceId: service.id },
    searchKeys: [service.id, service.name, service.iconName],
  }));
}

/**
 * Materialises one `ElementDescriptor` per category of a cloud family.
 *
 * Does not register them — the caller (`bootstrap`, or a test) decides when
 * they enter the registry. Remembers the family's `IconResolver` so
 * `palette.icon: { kind: "family" }` has a lookup.
 *
 * @example
 * const descriptors = buildCloudFamilyDescriptors(gcpFamily);
 * for (const descriptor of descriptors) {
 *   if (!hasElement(descriptor.id)) registerElement(descriptor);
 * }
 */
export function buildCloudFamilyDescriptors(family: CloudFamilyDefinition): ElementDescriptor[] {
  if (family.categories.length === 0) {
    fail(family.id, "categories is empty");
  }

  const categoryIds = new Set<string>(family.categories.map((category) => category.id));
  for (const service of family.services) {
    if (!categoryIds.has(service.categoryId)) {
      fail(
        family.id,
        `service "${service.id}" references unknown categoryId "${service.categoryId}"`,
      );
    }
  }

  rememberFamilyIconResolver(family.id, family.icons);

  return family.categories.map((category) => {
    const categoryServices = servicesForCategory(family.services, category.id);
    const variants = paletteVariantsFor(categoryServices);
    // A category with no services still registers (the type exists on the
    // closed union); the palette then offers the category itself rather than
    // variants. That is the honest representation of an empty catalog row.
    const defaultIconName = categoryServices[0]?.iconName ?? family.id;

    const descriptor: ElementDescriptor = {
      id: category.id,
      family: family.id,
      labelKey: category.labelKey,
      descriptionKey: category.descriptionKey,

      model: {
        createComponent: (base, options) =>
          family.attachService(base, category.id, options.serviceId),
        defaultSize: family.defaultSize,
        patchableKeys: family.patchableKeys,
        ...(family.defaultNameKey === undefined ? {} : { defaultNameKey: family.defaultNameKey }),
      },

      canvas: {
        // Distinct per category so React Flow's nodeTypes map and the
        // single-owner rfType invariant both stay honest, even though every
        // category shares the same card component.
        rfType: category.id,
        component: family.card.component,
        handles: family.card.handles,
        role: "card",
        zIndex: 1,
        connectable: true,
        canHaveParent: true,
        canBeParent: false,
        canBeConnectionSource: true,
        // Cards size from their content (title + icon); the stored layout is
        // a creation hint, not the painted authority.
        derivesSize: true,
        buildData: family.card.buildData,
        buildStyle: family.card.buildStyle,
      },

      palette: {
        categoryId: family.paletteCategoryId,
        icon: { kind: "family", iconName: defaultIconName },
        accent: category.accent,
        searchKeys: [category.id, family.id],
        ...(variants === undefined ? {} : { variants }),
      },

      inspector: family.inspector ?? {},

      export: {
        drawio: {
          toExportNode: family.export.toExportNode,
        },
      },
    };

    return descriptor;
  });
}
