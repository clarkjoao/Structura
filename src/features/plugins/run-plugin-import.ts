import { useDiagramStore } from "@/features/diagram";
import { toGeneratedGraph } from "./import-graph";
import type { ImportContext, ImporterContribution } from "./plugin.types";
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

/**
 * Run a plugin importer against the active diagram: build the read-only ImportContext, then
 * normalize the returned plain data (`toGeneratedGraph`) and commit it through
 * `insertGeneratedGraph` — the store mints the ids, nests what can be nested, and the whole
 * import is a single undo step.
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
  const connections = result.connections ?? [];
  const graph = toGeneratedGraph({ components: result.components ?? [], connections });
  const inserted = state.insertGeneratedGraph(graph.nodes, graph.edges, { linkExisting: true });

  return {
    ok: true,
    importedComponentIds: inserted.componentIds,
    warnings,
    skippedConnections: connections.length - inserted.connectionIds.length,
  };
}
