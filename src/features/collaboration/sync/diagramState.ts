import {
  COLLECTIONS,
  LEGACY_DOC_FIELDS,
  applyEffectivePatch,
  type CollectionName,
  type DiagramPatch,
  type DiagramState,
  type EntityMap,
} from "@collab-protocol";
import type { Diagram, DiagramSnapshot } from "@/features/diagram";
import { normalizeLayoutSettings } from "@/features/diagram/model/layout-settings";

/**
 * The doc fields a relay accepts. Until a relay declares more (`joined.docFields`), a session
 * syncs only the legacy set: an older relay refuses a patch or a seed with any other field.
 */
export type DocFieldSet = ReadonlySet<string>;
export const LEGACY_DOC_FIELD_SET: DocFieldSet = new Set(LEGACY_DOC_FIELDS);

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

export function diagramToState(
  diagram: Diagram,
  fields: DocFieldSet = LEGACY_DOC_FIELD_SET,
): DiagramState {
  const doc: DiagramState["doc"] = {
    diagramId: diagram.id,
    diagramName: diagram.name,
    level: diagram.level,
    domain: diagram.domain ?? null,
    description: diagram.description ?? null,
    activeVersionId: diagram.activeVersionId ?? null,
    compareVersionId: diagram.compareVersionId ?? null,
    // Only to a relay that declared them (ADR-0013 step 4). `null` is "not set": left-to-right,
    // default arrange settings.
    ...(fields.has("direction") && { direction: diagram.direction ?? null }),
    ...(fields.has("layoutSettings") && { layoutSettings: diagram.layoutSettings ?? null }),
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
    ...withLayoutDoc(diagram, state.doc),
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

/**
 * The reading direction and arrange settings a remote `doc` carries, sanitised. A field the doc
 * does not have (an older relay, or a room nobody wrote it in) leaves the local value alone;
 * `null` clears it.
 */
function withLayoutDoc<T extends Pick<Diagram, "direction" | "layoutSettings">>(
  target: T,
  doc: DiagramState["doc"],
): T {
  let next = target;
  if ("direction" in doc) {
    const { direction: _direction, ...rest } = next;
    next = (doc.direction === "TB" ? { ...rest, direction: "TB" } : rest) as T;
  }
  if ("layoutSettings" in doc) {
    const { layoutSettings: _settings, ...rest } = next;
    const settings = isRecordValue(doc.layoutSettings)
      ? normalizeLayoutSettings(doc.layoutSettings)
      : undefined;
    next = (settings ? { ...rest, layoutSettings: settings } : rest) as T;
  }
  return next;
}

function isRecordValue(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  // A peer's direction or arrange settings go into the checkpoint too, or undo would put the
  // old ones back over the peer's change.
  const base = patch.doc ? withLayoutDoc(checkpoint, patch.doc) : checkpoint;
  if (!patch.entities) return base;
  const before: DiagramState = {
    doc: {},
    entities: {
      components: entityMap(base.snapshot.components),
      connections: entityMap(base.snapshot.connections),
      flows: entityMap(base.snapshot.flows),
      iconLibrary: entityMap(base.snapshot.iconLibrary),
      nodeLayouts: entityMap(base.nodeLayouts),
      edgeLayouts: entityMap(base.edgeLayouts),
      versions: entityMap(base.versions),
    },
  };
  const after = applyEffectivePatch(before, { entities: patch.entities });
  if (after === before) return base;
  const e = after.entities;
  return {
    ...base,
    snapshot: {
      ...base.snapshot,
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
