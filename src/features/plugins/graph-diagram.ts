import type { Diagram } from "@/features/diagram/model/diagram.types";
import { createDiagramStore } from "@/features/diagram/store/diagram.store";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import { connectionKeys } from "./connection-keys";
import { toGeneratedGraph } from "./import-graph";
import type { ImportResult } from "./plugin.types";

export type ImporterGraphInput = Pick<ImportResult, "components" | "connections">;

/**
 * An importer graph (plugin API 1.3) as a diagram, built in a throwaway in-memory store the way
 * importing it would build it — the type policy, the canvas's sizes, parents — and nothing
 * persisted. Components are keyed by their `key`, connections by `connectionKeys`, so the same
 * graph always gives the same ids. The embed preview draws it; `api.layout.place` lays it out.
 */
export function diagramFromImporterGraph(graph: ImporterGraphInput, id: string): Diagram {
  const store = createDiagramStore(new InMemoryAdapter());
  const created = store.getState().addDiagram("preview", "container");
  store.getState().openDiagram(created.id);
  const { nodes, edges } = toGeneratedGraph(graph);
  const inserted = store.getState().insertGeneratedGraph(nodes, edges);
  const diagram = store.getState().diagrams[created.id]!;

  const stableId = new Map<string, string>();
  for (const [key, id] of Object.entries(inserted.componentIdByExternalId)) stableId.set(id, key);
  const component = (id: string | null) => (id === null ? null : (stableId.get(id) ?? id));

  const components: Diagram["snapshot"]["components"] = {};
  const nodeLayouts: Diagram["nodeLayouts"] = {};
  for (const [id, value] of Object.entries(diagram.snapshot.components)) {
    const key = component(id)!;
    components[key] = { ...value, id: key, parentId: component(value.parentId) };
    const layout = diagram.nodeLayouts[id];
    if (layout) nodeLayouts[key] = { ...layout, elementId: key };
  }

  const values = Object.values(diagram.snapshot.connections).map((value) => ({
    ...value,
    sourceId: component(value.sourceId)!,
    targetId: component(value.targetId)!,
  }));
  const ids = connectionKeys(
    values.map((v) => ({ source: v.sourceId, target: v.targetId, label: v.label })),
  );
  const connections: Diagram["snapshot"]["connections"] = {};
  values.forEach((value, i) => {
    connections[ids[i]!] = { ...value, id: ids[i]! };
  });

  return {
    ...diagram,
    id,
    snapshot: { ...diagram.snapshot, components, connections },
    nodeLayouts,
    edgeLayouts: {},
  };
}
