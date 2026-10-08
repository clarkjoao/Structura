import type { Diagram } from "@/features/diagram/model/diagram.types";
import { createDiagramStore } from "@/features/diagram/store/diagram.store";
import { toGeneratedGraph } from "@/features/plugins/import-graph";
import { InMemoryAdapter } from "@/infrastructure/persistence";
import type { PreviewGraph } from "./protocol";

/** One id for every picture, so the canvas treats an update as the same diagram. */
export const PREVIEW_DIAGRAM_ID = "structura-embed-preview";

/**
 * Builds the diagram for a posted graph, in a throwaway in-memory store — nothing is
 * persisted. Ids are made stable (`key` for components, ends + label + occurrence for
 * connections), so an update that keeps an element keeps its node: React Flow updates it in
 * place instead of remounting the whole picture.
 */
export function buildPreviewDiagram(graph: PreviewGraph): Diagram {
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

  const seen = new Map<string, number>();
  const connections: Diagram["snapshot"]["connections"] = {};
  for (const value of Object.values(diagram.snapshot.connections)) {
    const sourceId = component(value.sourceId)!;
    const targetId = component(value.targetId)!;
    const base = `${sourceId}->${targetId}:${value.label}`;
    const n = seen.get(base) ?? 0;
    seen.set(base, n + 1);
    const id = `${base}#${n}`;
    connections[id] = { ...value, id, sourceId, targetId };
  }

  return {
    ...diagram,
    id: PREVIEW_DIAGRAM_ID,
    snapshot: { ...diagram.snapshot, components, connections },
    nodeLayouts,
    edgeLayouts: {},
  };
}

/**
 * What changed between two graphs, as node ids to bring into view: components that are new or
 * whose content changed (not their position), and both ends of new connections. Nothing for the
 * first graph — the whole picture is new then.
 */
export function changedComponentIds(previous: PreviewGraph | null, next: PreviewGraph): string[] {
  if (!previous) return [];
  const content = (c: PreviewGraph["components"][number]) =>
    JSON.stringify([c.name, c.description, c.type, c.cloudServiceId, c.technology, c.parentKey]);
  const before = new Map(previous.components.map((c) => [c.key, content(c)]));
  const changed = new Set(
    next.components.filter((c) => before.get(c.key) !== content(c)).map((c) => c.key),
  );
  const keysOf = (graph: PreviewGraph) => {
    const seen = new Map<string, number>();
    return graph.connections.map((c) => {
      const base = `${c.source}->${c.target}:${c.label ?? ""}`;
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      return `${base}#${n}`;
    });
  };
  const old = new Set(keysOf(previous));
  keysOf(next).forEach((key, i) => {
    if (old.has(key)) return;
    changed.add(next.connections[i]!.source);
    changed.add(next.connections[i]!.target);
  });
  return [...changed];
}
