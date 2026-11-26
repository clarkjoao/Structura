import CardNode from "@/features/canvas/nodes/CardNode";
import { SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import {
  buildCardNodeData,
  buildCardNodeStyle,
} from "@/features/canvas/nodes/CardNode/buildCardNodeData";
import { DEFAULT_NODE_H, DEFAULT_NODE_W } from "@/features/diagram/model/layout.constants";
import {
  cloudServiceIdWrite,
  resolveCloudServiceId,
} from "@/features/diagram/model/cloud-service-id";
import { isPluginComponentType } from "@/features/diagram/model/component-type-constants";
import type { Component } from "@/features/diagram/model/component.types";
import i18n from "@/infrastructure/i18n/i18n";
import { allElements, hasElement, registerElement, unregisterElement } from "../element.registry";
import type { ElementDescriptor, ElementTypeId } from "../element.types";
import type { CloudFamilyDefinition, CloudFamilyService } from "../families/cloud-family.types";
import {
  isRegisteredCloudFamily,
  registerCloudFamily,
  unregisterCloudFamily,
} from "../families/cloud-family.registry";
import type { CatalogConceptId } from "../search/concepts";
import { genericPackAdapter, type PackAdapter } from "./pack.adapter";
import { accentToken, injectPackAccents, removePackAccents } from "./pack.accents";
import { addPackStrings, packKeys, removePackStrings } from "./pack.i18n";
import { packIconResolver, type PackIconSource } from "./pack.icons";
import { packTypeId, type ElementPack, type PackService } from "./pack.schema";
import { buildShapeDescriptors } from "./pack.shapes";

/**
 * Turns a validated pack into registry entries — one loader for built-in packs and plugins.
 *
 * Categories and services become a `CloudFamilyDefinition` (so the palette, element catalog,
 * pickers, LLM catalog and export see them exactly as they see AWS), shapes become
 * `ElementDescriptor`s drawn by `ShapeNode`. Strings and accents are installed first, because
 * `registerElement` refuses a label key that does not resolve.
 */

function fail(packId: string, reason: string): never {
  throw new Error(`[element-packs] Cannot register pack "${packId}": ${reason}`);
}

/** The registered type of a pack entry, narrowed without a cast. */
function packElementTypeId(
  pack: ElementPack,
  localId: string,
  adapter: PackAdapter = genericPackAdapter,
): ElementTypeId {
  const typeId = packTypeId(pack, localId);
  if (pack.typeIds === "verbatim") {
    const typed = adapter.typeIdOf?.(typeId);
    if (typed === undefined) {
      fail(pack.id, `its adapter does not recognise the verbatim type id "${typeId}".`);
    }
    return typed;
  }
  if (!isPluginComponentType(typeId)) fail(pack.id, `"${typeId}" is not a namespaced type id.`);
  return typeId;
}

function technologyOf(comp: Component): string | undefined {
  return "technology" in comp && typeof comp.technology === "string" ? comp.technology : undefined;
}

/**
 * The family a pack's categories make. Pure: registers nothing, so the legacy family modules
 * can still export their `CloudFamilyDefinition` for tests and the descriptor builder.
 */
export function familyFromPack(
  pack: ElementPack,
  adapter: PackAdapter = genericPackAdapter,
  icons: ReadonlyMap<string, PackIconSource> = new Map(),
): CloudFamilyDefinition {
  if (pack.categories.length === 0) fail(pack.id, "a family needs at least one category.");
  const typeOf = (localId: string) => packElementTypeId(pack, localId, adapter);
  const labelKey = packKeys.label(pack.id);
  const iconDataUri =
    adapter.iconDataUri ?? ((iconName: string) => icons.get(iconName)?.dataUri() ?? null);

  const services: CloudFamilyService[] = pack.services.map((service) => ({
    id: service.id,
    name: service.name,
    iconName: service.icon,
    categoryId: typeOf(service.category),
    ...(service.concepts ? { concepts: service.concepts } : {}),
    ...(service.description
      ? { descriptionKey: packKeys.serviceDescription(pack.id, service.id) }
      : {}),
  }));

  const serviceFor = (comp: Component): PackService | undefined => {
    const serviceId = resolveCloudServiceId(comp);
    if (!serviceId) return undefined;
    const candidates = pack.services.filter((service) => service.id === serviceId);
    return candidates.find((service) => typeOf(service.category) === comp.type) ?? candidates[0];
  };

  const preferred: Partial<Record<CatalogConceptId, string>> | undefined =
    pack.preferredServiceByConcept;

  return {
    id: pack.id,
    labelKey,
    paletteCategoryId: pack.id,
    ...(pack.primaryCategories ? { primaryCategoryIds: pack.primaryCategories.map(typeOf) } : {}),
    ...(pack.spotlightServices ? { spotlightServiceIds: pack.spotlightServices } : {}),
    ...(preferred ? { preferredServiceByConcept: preferred } : {}),

    categories: pack.categories.map((category) => ({
      id: typeOf(category.id),
      labelKey: packKeys.categoryLabel(pack.id, category.id),
      descriptionKey: packKeys.categoryDescription(pack.id, category.id),
      accent: accentToken(pack, category),
    })),
    services,
    icons: adapter.icons ?? packIconResolver(icons),

    card: {
      component: CardNode,
      handles: SPREAD_HANDLES,
      buildData: buildCardNodeData,
      buildStyle: buildCardNodeStyle,
    },

    export: {
      toExportNode: (comp, base) => {
        const service = serviceFor(comp);
        const dataUri = service ? iconDataUri(service.icon) : null;
        if (adapter.toExportNode) {
          return adapter.toExportNode(comp, base, { pack, service, iconDataUri: dataUri });
        }
        // Same control point as domain writes — projects onto ExportNode only.
        const cloudServiceIdField = cloudServiceIdWrite(resolveCloudServiceId(comp));
        if (dataUri) {
          return {
            ...base,
            kind: "image",
            name: comp.name,
            dataUri,
            preserveAspect: true,
            ...cloudServiceIdField,
          };
        }
        // The F2 floor: no stencil and no icon — keep the identity rather than disguising it.
        return {
          ...base,
          kind: "passthrough",
          name: comp.name,
          description: service?.name ?? technologyOf(comp),
          originType: comp.type,
          originLabel: i18n.t(labelKey),
          ...cloudServiceIdField,
        };
      },
    },

    defaultSize: { width: DEFAULT_NODE_W, height: DEFAULT_NODE_H },
    patchableKeys: adapter.patchableKeys ?? ["cloudServiceId", "technology", "customColor"],

    attachService:
      adapter.attachService ??
      ((base, categoryId, serviceId) => {
        if (!isPluginComponentType(categoryId)) {
          fail(pack.id, `attachService got "${categoryId}", which is not one of its types.`);
        }
        return { ...base, type: categoryId, ...cloudServiceIdWrite(serviceId) };
      }),
    ...(adapter.inspector ? { inspector: adapter.inspector } : {}),
  };
}

export interface RegisterPackOptions {
  adapter?: PackAdapter;
  icons?: ReadonlyMap<string, PackIconSource>;
}

export interface RegisteredPack {
  readonly pack: ElementPack;
  /** Every element type the pack registered. */
  readonly typeIds: readonly ElementTypeId[];
  unregister(): void;
}

/** Registers a validated pack; throws, registering nothing, when any of it collides. */
export function registerElementPack(
  pack: ElementPack,
  options: RegisterPackOptions = {},
): RegisteredPack {
  const adapter = options.adapter ?? genericPackAdapter;
  const icons = options.icons ?? new Map<string, PackIconSource>();

  // A legacy family may already own hand-written elements (Kubernetes' cluster and namespace
  // register under `k8s` before its pack); any other pack must bring a family id of its own.
  const familyTaken =
    isRegisteredCloudFamily(pack.id) ||
    (pack.typeIds !== "verbatim" && allElements().some((el) => el.family === pack.id));
  if (familyTaken) fail(pack.id, "a family with this id is already registered.");
  for (const service of pack.services) {
    if (adapter.icons === undefined && !icons.has(service.icon)) {
      fail(pack.id, `service "${service.id}" uses icon "${service.icon}", which the pack lacks.`);
    }
  }
  const typeIds = [
    ...pack.categories.map((category) => packElementTypeId(pack, category.id, adapter)),
    ...pack.shapes.map((shape) => packElementTypeId(pack, shape.id, adapter)),
  ];
  for (const typeId of typeIds) {
    if (hasElement(typeId)) fail(pack.id, `element "${typeId}" is already registered.`);
  }

  addPackStrings(pack);
  injectPackAccents(pack);
  const shapes: ElementDescriptor[] = buildShapeDescriptors(pack, (id) =>
    packElementTypeId(pack, id, adapter),
  );
  const registeredShapes: ElementTypeId[] = [];
  let familyRegistered = false;

  const unregister = () => {
    if (familyRegistered) unregisterCloudFamily(pack.id);
    for (const id of registeredShapes) unregisterElement(id);
    removePackAccents(pack.id);
    removePackStrings(pack);
  };

  try {
    if (pack.categories.length > 0) {
      registerCloudFamily(familyFromPack(pack, adapter, icons));
      familyRegistered = true;
    }
    for (const shape of shapes) {
      registerElement(shape);
      registeredShapes.push(shape.id);
    }
  } catch (error) {
    unregister();
    throw error;
  }

  return { pack, typeIds, unregister };
}
