import type { Component, Connection } from "@/features/diagram/model";

/*
 * Compact typed containers, as the view draws them. Pure: components and the
 * set of compact container ids in, answers out — no registry, no store.
 *
 * Compact changes the drawing only. The children stay in the model, their
 * edges stay attached to them, and flow steps keep pointing at them; this
 * module says what each of those is drawn as.
 */

/**
 * The element a reader actually sees for `elementId`: the element itself, or
 * — when it sits inside compact containers — the **outermost** compact one.
 * Outermost, not nearest: a namespace compact inside a compact cluster is
 * itself hidden, so only the cluster is on screen.
 */
export function visibleAncestorOf(
  elementId: string,
  components: Record<string, Component>,
  compactIds: ReadonlySet<string>,
): string {
  let visible = elementId;
  let currentId = components[elementId]?.parentId ?? null;
  const seen = new Set<string>([elementId]);
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    if (compactIds.has(currentId)) visible = currentId;
    currentId = components[currentId]?.parentId ?? null;
  }
  return visible;
}

/** The ancestors of `elementId`, innermost first. */
export function ancestorsOf(elementId: string, components: Record<string, Component>): string[] {
  const out: string[] = [];
  let currentId = components[elementId]?.parentId ?? null;
  const seen = new Set<string>([elementId]);
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    out.push(currentId);
    currentId = components[currentId]?.parentId ?? null;
  }
  return out;
}

/**
 * The connections as drawn: an end hidden inside a compact container is
 * anchored on that container instead. The connection keeps its id (steps,
 * selection and labels still find it); one that would now start and end on
 * the same container — a router to a shard inside a compact store — is not
 * drawn at all. Unchanged connections are returned as the same objects.
 */
export function remapConnectionsToVisible(
  connections: readonly Connection[],
  components: Record<string, Component>,
  compactIds: ReadonlySet<string>,
): Connection[] {
  if (compactIds.size === 0) return connections as Connection[];
  const out: Connection[] = [];
  for (const connection of connections) {
    const sourceId = visibleAncestorOf(connection.sourceId, components, compactIds);
    const targetId = visibleAncestorOf(connection.targetId, components, compactIds);
    if (sourceId === connection.sourceId && targetId === connection.targetId) {
      out.push(connection);
      continue;
    }
    if (sourceId === targetId) continue;
    out.push({ ...connection, sourceId, targetId });
  }
  return out;
}
