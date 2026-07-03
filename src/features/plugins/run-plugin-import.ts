import type { Component, Connection, NodeLayout } from "@/features/diagram";
import { generateId, isC4Type, isPluginComponentType, useDiagramStore } from "@/features/diagram";
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

function buildComponentFromInput(input: PluginComponentInput, id: string): Component {
  const base = {
    id,
    name: input.name,
    description: input.description ?? "",
    parentId: null,
  };
  const type = input.type ?? "unknown";
  // MVP-supported types: C4 shapes, plugin-namespaced types, everything else degrades to
  // `unknown` — other built-ins carry required fields a plain data input cannot guarantee.
  if (isC4Type(type)) return { ...base, type };
  if (isPluginComponentType(type)) return { ...base, type };
  return { ...base, type: "unknown", rawContent: "" };
}

/**
 * Run a plugin importer against the active diagram: build the read-only ImportContext,
 * normalize the returned plain data (host-assigned ids), and commit everything through
 * `importDrawioResult`, which pushes one history step — a single undo reverts the import.
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

  const keyToId: Record<string, string> = {};
  const components: Component[] = [];
  const layouts: NodeLayout[] = [];
  for (const input of result.components ?? []) {
    const id = generateId("el");
    keyToId[input.key] = id;
    components.push(buildComponentFromInput(input, id));
    layouts.push({
      elementId: id,
      x: input.x,
      y: input.y,
      ...(input.width !== undefined ? { width: input.width } : {}),
      ...(input.height !== undefined ? { height: input.height } : {}),
    });
  }

  const resolveEndpoint = (ref: string): string | null =>
    keyToId[ref] ?? (diagram.snapshot.components[ref] ? ref : null);

  const connections: Connection[] = [];
  let skippedConnections = 0;
  for (const input of result.connections ?? []) {
    const sourceId = resolveEndpoint(input.source);
    const targetId = resolveEndpoint(input.target);
    if (!sourceId || !targetId) {
      skippedConnections += 1;
      continue;
    }
    connections.push({ id: generateId("conn"), sourceId, targetId, label: input.label ?? "" });
  }

  const importedComponentIds = state.importDrawioResult(components, connections, layouts);
  return { ok: true, importedComponentIds, warnings, skippedConnections };
}
