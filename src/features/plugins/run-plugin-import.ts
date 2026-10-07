import type { ComponentType } from "@/features/diagram";
import { isC4Type, isPanelType, isPluginComponentType, useDiagramStore } from "@/features/diagram";
import type { GeneratedNodeInput } from "@/features/diagram/store/slices/generated-graph.slice";
import { getElement } from "@/features/elements";
import { getCloudFamily } from "@/features/elements/families/cloud-family.registry";
import type { ImportContext, ImporterContribution, PluginComponentInput } from "./plugin.types";
import { toComponentSnapshot, toConnectionSnapshot } from "./snapshots";

export type PluginImportOutcome =
  | {
      ok: true;
      importedComponentIds: string[];
      /** Plugin-provided warnings, shown verbatim (plugin text is not in the i18n catalogs). */
      warnings: string[];
      /** Connections whose endpoints could not be resolved; reported via i18n by the UI. */
      skippedConnections: number;
    }
  | { ok: false; reason: "no-active-diagram" }
  | { ok: false; reason: "importer-failed"; error: unknown };

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
 * Run a plugin importer against the active diagram: build the read-only ImportContext, then
 * normalize the returned plain data and commit it through `insertGeneratedGraph` — the store
 * mints the ids, nests what can be nested, and the whole import is a single undo step.
 */
export async function runPluginImport(
  importer: ImporterContribution,
  contents: string,
): Promise<PluginImportOutcome> {
  const state = useDiagramStore.getState();
  const diagram = state.activeDiagramId ? state.diagrams[state.activeDiagramId] : null;
  if (!diagram) return { ok: false, reason: "no-active-diagram" };

  const { viewport } = diagram;
  const context: ImportContext = {
    existingComponents: Object.fromEntries(
      Object.entries(diagram.snapshot.components).map(([id, component]) => [
        id,
        toComponentSnapshot(component, diagram.nodeLayouts[id]),
      ]),
    ),
    existingConnections: Object.fromEntries(
      Object.entries(diagram.snapshot.connections).map(([id, connection]) => [
        id,
        toConnectionSnapshot(connection),
      ]),
    ),
    // Anchor at the current viewport origin so imported content lands in view.
    anchor: { x: -viewport.x / viewport.zoom + 100, y: -viewport.y / viewport.zoom + 100 },
  };

  let result;
  try {
    result = await importer.import(contents, context);
  } catch (error) {
    return { ok: false, reason: "importer-failed", error };
  }

  const warnings = (result.warnings ?? []).filter((w): w is string => typeof w === "string");
  const inputs = result.components ?? [];
  const parentOf = parentKeysWithoutCycles(inputs);

  const nodes = inputs.map((input): GeneratedNodeInput => {
    const technology = typeof input.technology === "string" ? input.technology : undefined;
    const cloudServiceId =
      typeof input.cloudServiceId === "string" ? input.cloudServiceId : undefined;
    return {
      externalId: input.key,
      type: importedType(input.type),
      name: input.name,
      ...(input.description !== undefined ? { description: input.description } : {}),
      parentExternalId: parentOf.get(input.key) ?? null,
      ...(cloudServiceId !== undefined ? { cloudServiceId } : {}),
      ...(technology !== undefined ? { technology } : {}),
      x: input.x,
      y: input.y,
      ...(input.width !== undefined ? { width: input.width } : {}),
      ...(input.height !== undefined ? { height: input.height } : {}),
    };
  });

  const connections = result.connections ?? [];
  const inserted = state.insertGeneratedGraph(
    nodes,
    connections.map((connection) => ({
      sourceExternalId: connection.source,
      targetExternalId: connection.target,
      label: connection.label ?? "",
    })),
    { linkExisting: true },
  );

  return {
    ok: true,
    importedComponentIds: inserted.componentIds,
    warnings,
    skippedConnections: connections.length - inserted.connectionIds.length,
  };
}
