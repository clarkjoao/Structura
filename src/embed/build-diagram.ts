import type { Diagram } from "@/features/diagram/model/diagram.types";
import { connectionKeys } from "@/features/plugins/connection-keys";
import { diagramFromImporterGraph } from "@/features/plugins/graph-diagram";
import type { PreviewGraph } from "./protocol";

/** One id for every picture, so the canvas treats an update as the same diagram. */
export const PREVIEW_DIAGRAM_ID = "structura-embed-preview";

/**
 * Connections are named by `connectionKeys` — ends, label and occurrence — in the canvas ids and
 * in change detection, and a host names them the same way (`STRUCTURA_REVEAL`, `STRUCTURA_SELECT`).
 */
export { connectionKeys };

/**
 * Builds the diagram for a posted graph, in a throwaway in-memory store — nothing is
 * persisted. Ids are made stable (`key` for components, ends + label + occurrence for
 * connections), so an update that keeps an element keeps its node: React Flow updates it in
 * place instead of remounting the whole picture.
 */
export function buildPreviewDiagram(graph: PreviewGraph): Diagram {
  return diagramFromImporterGraph(graph, PREVIEW_DIAGRAM_ID);
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
  const old = new Set(connectionKeys(previous.connections));
  connectionKeys(next.connections).forEach((key, i) => {
    if (old.has(key)) return;
    changed.add(next.connections[i]!.source);
    changed.add(next.connections[i]!.target);
  });
  return [...changed];
}
