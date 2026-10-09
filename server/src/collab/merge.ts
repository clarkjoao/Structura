import {
  COLLECTIONS,
  IMMUTABLE_DOC_FIELDS,
  LOCK_GUARDED_FIELDS,
  type CollectionName,
  type DiagramPatch,
  type DiagramState,
  type Entity,
  type EntityPatch,
} from "./protocol.js";

/**
 * The room-side merge: field-level last-writer-wins, remove-wins over a concurrent edit, and
 * soft-lock enforcement. `MemoryRoomStore` runs it directly; `apply.lua` implements the same
 * rules for Redis, and the shared fixture suite holds both to it.
 */

export interface MergeContext {
  /** Room version the sender had applied when it composed the patch. */
  senderVersion: number;
  senderId: string;
  /** Holder of an entity's soft lock, or null. */
  lockHolder: (entityId: string) => string | null;
}

export interface MergeTarget {
  state: DiagramState;
  /** `collection/entityId` → version at which the entity was removed. */
  tombstones: Map<string, number>;
}

/** Stable value identity for "did this field actually change". */
export function encodeValue(value: unknown): string {
  return JSON.stringify(value) ?? "null";
}

export function tombstoneKey(collection: CollectionName, entityId: string): string {
  return `${collection}/${entityId}`;
}

function guardedFields(collection: CollectionName): readonly string[] {
  return LOCK_GUARDED_FIELDS[collection] ?? [];
}

/**
 * Merge `patch` into `target` in place as the change that will get `nextVersion`, and return
 * the portion that took effect. An empty result means nothing changed and no version is used.
 */
export function mergePatch(
  target: MergeTarget,
  patch: DiagramPatch,
  nextVersion: number,
  ctx: MergeContext,
): DiagramPatch {
  const effective: DiagramPatch = {};

  if (patch.doc) {
    for (const [field, value] of Object.entries(patch.doc)) {
      if (IMMUTABLE_DOC_FIELDS.has(field)) continue;
      const doc = target.state.doc as Record<string, unknown>;
      const present = Object.prototype.hasOwnProperty.call(doc, field);
      if (present && encodeValue(doc[field]) === encodeValue(value)) continue;
      doc[field] = value;
      (effective.doc ??= {})[field as keyof typeof patch.doc] = value;
    }
  }

  if (patch.entities) {
    for (const collection of COLLECTIONS) {
      const byId = patch.entities[collection];
      if (!byId) continue;
      for (const [entityId, entityPatch] of Object.entries(byId)) {
        const applied = mergeEntity(target, collection, entityId, entityPatch, nextVersion, ctx);
        if (applied === undefined) continue;
        const entitiesOut = (effective.entities ??= {});
        (entitiesOut[collection] ??= {})[entityId] = applied;
      }
    }
  }

  return effective;
}

/** Returns the effective entity patch, or undefined when nothing took effect. */
function mergeEntity(
  target: MergeTarget,
  collection: CollectionName,
  entityId: string,
  entityPatch: EntityPatch,
  nextVersion: number,
  ctx: MergeContext,
): EntityPatch | undefined {
  const collectionState = target.state.entities[collection];
  const existing: Entity | undefined = collectionState[entityId];
  const tombKey = tombstoneKey(collection, entityId);

  if (entityPatch === null) {
    if (!existing) return undefined;
    delete collectionState[entityId];
    target.tombstones.set(tombKey, nextVersion);
    return null;
  }

  const deletedAt = target.tombstones.get(tombKey);
  if (deletedAt !== undefined) {
    // Composed before it saw the removal: the removal wins.
    if (ctx.senderVersion < deletedAt) return undefined;
  }

  const holder = ctx.lockHolder(entityId);
  const blocked = holder !== null && holder !== ctx.senderId ? guardedFields(collection) : [];

  const entity: Entity = existing ? existing : {};
  const set: Entity = {};
  const unset: string[] = [];

  for (const [field, value] of Object.entries(entityPatch.set ?? {})) {
    if (blocked.includes(field)) continue;
    if (Object.prototype.hasOwnProperty.call(entity, field)) {
      if (encodeValue(entity[field]) === encodeValue(value)) continue;
    }
    set[field] = value;
  }
  for (const field of entityPatch.unset ?? []) {
    if (blocked.includes(field)) continue;
    if (!Object.prototype.hasOwnProperty.call(entity, field)) continue;
    unset.push(field);
  }

  const hasSet = Object.keys(set).length > 0;
  if (!hasSet && unset.length === 0) return undefined;
  // A field-only removal cannot create an entity.
  if (!existing && !hasSet) return undefined;

  for (const [field, value] of Object.entries(set)) entity[field] = value;
  for (const field of unset) delete entity[field];
  if (!existing) collectionState[entityId] = entity;
  if (deletedAt !== undefined) target.tombstones.delete(tombKey);

  const out: { set?: Entity; unset?: string[] } = {};
  if (hasSet) out.set = set;
  if (unset.length > 0) out.unset = unset;
  return out;
}
