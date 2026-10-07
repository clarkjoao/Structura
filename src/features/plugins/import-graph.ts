import type { ComponentType } from "@/features/diagram/model/component.types";
import {
  isC4Type,
  isPanelType,
  isPluginComponentType,
} from "@/features/diagram/model/component-type-constants";
import type {
  GeneratedEdgeInput,
  GeneratedNodeInput,
} from "@/features/diagram/store/slices/generated-graph.slice";
import { cloudServiceIdWrite } from "@/features/diagram/model/cloud-service-id";
import { getElement } from "@/features/elements/element.registry";
import { getCloudFamily } from "@/features/elements/families/cloud-family.registry";
import type { ImportResult, PluginComponentInput } from "./plugin.types";

// Leaf imports, not the `@/features/diagram` barrel: the embed preview uses this module and
// must not pull the store's whole surface (or the editor) into its entry.

/** Whether `type` is a category of a registered catalog family (aws-database, oss-messaging, …). */
function isCatalogCategoryType(type: string): boolean {
  const family = getElement(type)?.family;
  if (family === undefined) return false;
  return getCloudFamily(family)?.categories.some((category) => category.id === type) === true;
}

/**
 * The type an imported component is created with. C4 shapes, panels, catalog categories and
 * plugin-namespaced types are kept; other built-ins carry semantics a plain data input cannot
 * express (an endpoint's handlers, a note's text) and degrade to `unknown`, as before 1.3.
 */
function importedType(type: string | undefined): ComponentType {
  if (type === undefined) return "unknown";
  if (isC4Type(type) || isPanelType(type) || isPluginComponentType(type)) return type;
  if (isCatalogCategoryType(type)) return type as ComponentType;
  return "unknown";
}

/**
 * `parentKey`s that stay inside the batch and close a loop are dropped, so the store is never
 * handed a cycle. Keys outside the batch are left for the store to resolve against the diagram.
 */
function parentKeysWithoutCycles(inputs: readonly PluginComponentInput[]): Map<string, string> {
  const parentOf = new Map<string, string>();
  for (const input of inputs) {
    if (input.parentKey !== undefined) parentOf.set(input.key, input.parentKey);
  }
  for (const input of inputs) {
    const seen = new Set([input.key]);
    for (let key = input.key; parentOf.has(key);) {
      const parent = parentOf.get(key)!;
      if (seen.has(parent)) {
        parentOf.delete(key);
        break;
      }
      seen.add(parent);
      key = parent;
    }
  }
  return parentOf;
}

/**
 * Importer-shaped data (plugin API 1.3) as store input for `insertGeneratedGraph`: the type
 * policy applied, parent cycles cut, keys as external ids. Shared by plugin imports and the
 * embed preview, so a graph posted to the preview draws exactly what importing it would.
 */
export function toGeneratedGraph(result: Pick<ImportResult, "components" | "connections">): {
  nodes: GeneratedNodeInput[];
  edges: GeneratedEdgeInput[];
} {
  const parentOf = parentKeysWithoutCycles(result.components);
  const nodes = result.components.map((input): GeneratedNodeInput => {
    const technology = typeof input.technology === "string" ? input.technology : undefined;
    return {
      externalId: input.key,
      type: importedType(input.type),
      name: input.name,
      ...(input.description !== undefined ? { description: input.description } : {}),
      parentExternalId: parentOf.get(input.key) ?? null,
      ...cloudServiceIdWrite(
        typeof input.cloudServiceId === "string" ? input.cloudServiceId : undefined,
      ),
      ...(technology !== undefined ? { technology } : {}),
      x: input.x,
      y: input.y,
      ...(input.width !== undefined ? { width: input.width } : {}),
      ...(input.height !== undefined ? { height: input.height } : {}),
    };
  });
  const edges = result.connections.map((connection): GeneratedEdgeInput => ({
    sourceExternalId: connection.source,
    targetExternalId: connection.target,
    label: connection.label ?? "",
  }));
  return { nodes, edges };
}
