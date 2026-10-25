import type { Diagram, DiagramModel } from "@/features/diagram/model";
import type { VersionChanges } from "@/features/diagram/utils/version.utils";
import { resolveViewSnapshot, type DescribeNode, type ViewSnapshot } from "./resolveViewSnapshot";

/*
 * What a Version removes, drawn where the base has it (the changes view). Pure, like the view it
 * is cut from: the base's own view, kept to the removed elements and the removed connections whose
 * ends are drawn. Never part of the diagram state — the canvas appends it to what it draws.
 */

/**
 * The base view kept to what `changes` removes, or null when it removes nothing drawable. A ghost
 * nests in its base parent when that parent is drawn too (still in the Version, or a ghost).
 */
export function versionGhostView(
  diagram: Diagram | DiagramModel,
  changes: VersionChanges,
  liveComponentIds: ReadonlySet<string>,
  describe: DescribeNode,
  textsVisible?: boolean,
): ViewSnapshot | null {
  if (changes.removed.components.length === 0 && changes.removed.connections.length === 0) {
    return null;
  }
  const base = resolveViewSnapshot(
    diagram,
    { versionId: null, ...(textsVisible !== undefined ? { textsVisible } : {}) },
    describe,
  );
  const removed = new Set(changes.removed.components);
  const nodes = base.nodes
    .filter((n) => removed.has(n.component.id) && !n.isHidden)
    .map((n) => {
      const parentId = n.component.parentId;
      const parentDrawn =
        parentId != null && (liveComponentIds.has(parentId) || removed.has(parentId));
      return n.isChild && !parentDrawn ? { ...n, isChild: false } : n;
    });
  const drawn = (id: string) =>
    liveComponentIds.has(id) || nodes.some((n) => n.component.id === id);
  // Removed connections, and the base connections of a removed element (gone with it).
  const gone = new Set(changes.removed.connections);
  const connections = Object.values(base.connections).filter(
    (c) =>
      (gone.has(c.id) || removed.has(c.sourceId) || removed.has(c.targetId)) &&
      drawn(c.sourceId) &&
      drawn(c.targetId),
  );
  if (nodes.length === 0 && connections.length === 0) return null;
  return {
    ...base,
    nodes,
    placedConnections: connections,
    shownConnections: connections,
    showLegend: false,
  };
}
