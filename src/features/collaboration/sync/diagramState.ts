import {
  COLLECTIONS,
  applyEffectivePatch,
  type CollectionName,
  type DiagramPatch,
  type DiagramState,
  type EntityMap,
} from "@collab-protocol";
import type { Diagram, DiagramSnapshot } from "@/features/diagram";

/**
 * The bridge between the editor's `Diagram` and the wire's `DiagramState`. Only these fields are
 * synchronised; everything else on a diagram (folder, viewport, timestamps) is local and is never
 * read from or written by a session.
 *
 * Entity objects are passed through by reference both ways, so a diff between what the store holds
 * and what the session last wrote is a pointer comparison for every untouched entity.
 */

function entityMap(value: unknown): EntityMap {
  return (value ?? {}) as EntityMap;
}

/**
 * The trust boundary from wire to model: the relay only accepts records (see `isDiagramState`) and
 * every one of them was written by an editor, so entities are taken as the model type they were.
 */
function asModel<T>(map: EntityMap): Record<string, T> {
  return map as unknown as Record<string, T>;
}

export function diagramToState(diagram: Diagram): DiagramState {
  const doc: DiagramState["doc"] = {
    diagramId: diagram.id,
    diagramName: diagram.name,
    level: diagram.level,
    domain: diagram.domain ?? null,
    description: diagram.description ?? null,
    activeVersionId: diagram.activeVersionId ?? null,
    compareVersionId: diagram.compareVersionId ?? null,
  };
  const entities: Record<CollectionName, EntityMap> = {
    components: entityMap(diagram.snapshot.components),
    connections: entityMap(diagram.snapshot.connections),
    flows: entityMap(diagram.snapshot.flows),
    iconLibrary: entityMap(diagram.snapshot.iconLibrary),
    nodeLayouts: entityMap(diagram.nodeLayouts),
    edgeLayouts: entityMap(diagram.edgeLayouts),
    versions: entityMap(diagram.versions),
  };
  return { doc, entities };
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function nullableString(value: unknown): string | null {
  return typeof value === "string" ? value : null;
}

/**
 * Write the synchronised fields of `state` onto `diagram`, keeping every local-only field.
 * Collections that did not change keep their identity.
 */
export function applyStateToDiagram(diagram: Diagram, state: DiagramState): Diagram {
  const e = state.entities;
  return {
    ...diagram,
    name: typeof state.doc.diagramName === "string" ? state.doc.diagramName : diagram.name,
    level: typeof state.doc.level === "string" ? state.doc.level : diagram.level,
    domain: optionalString(state.doc.domain),
    description: optionalString(state.doc.description),
    activeVersionId: nullableString(state.doc.activeVersionId),
    compareVersionId: nullableString(state.doc.compareVersionId),
    snapshot: {
      ...diagram.snapshot,
      components: asModel(e.components),
      connections: asModel(e.connections),
      flows: asModel(e.flows),
      iconLibrary: asModel(e.iconLibrary),
    },
    nodeLayouts: asModel(e.nodeLayouts),
    edgeLayouts: asModel(e.edgeLayouts),
    versions: asModel(e.versions),
  };
}

/** True when the synchronised part of two states is the same, by reference. */
export function sameSyncedState(a: DiagramState, b: DiagramState): boolean {
  for (const collection of COLLECTIONS) {
    if (a.entities[collection] !== b.entities[collection]) return false;
  }
  for (const key of Object.keys({ ...a.doc, ...b.doc }) as Array<keyof DiagramState["doc"]>) {
    if (a.doc[key] !== b.doc[key]) return false;
  }
  return true;
}

/**
 * Carry a remote change into an undo checkpoint, so that undo reverts only the local user's own
 * work: a checkpoint taken before a peer's edit would otherwise bring the peer's old values back.
 */
export function applyPatchToCheckpoint(
  checkpoint: DiagramSnapshot,
  patch: DiagramPatch,
): DiagramSnapshot {
  if (!patch.entities) return checkpoint;
  const before: DiagramState = {
    doc: {},
    entities: {
      components: entityMap(checkpoint.snapshot.components),
      connections: entityMap(checkpoint.snapshot.connections),
      flows: entityMap(checkpoint.snapshot.flows),
      iconLibrary: entityMap(checkpoint.snapshot.iconLibrary),
      nodeLayouts: entityMap(checkpoint.nodeLayouts),
      edgeLayouts: entityMap(checkpoint.edgeLayouts),
      versions: entityMap(checkpoint.versions),
    },
  };
  const after = applyEffectivePatch(before, { entities: patch.entities });
  if (after === before) return checkpoint;
  const e = after.entities;
  return {
    ...checkpoint,
    snapshot: {
      ...checkpoint.snapshot,
      components: asModel(e.components),
      connections: asModel(e.connections),
      flows: asModel(e.flows),
      iconLibrary: asModel(e.iconLibrary),
    },
    nodeLayouts: asModel(e.nodeLayouts),
    edgeLayouts: asModel(e.edgeLayouts),
    versions: asModel(e.versions),
  };
}
