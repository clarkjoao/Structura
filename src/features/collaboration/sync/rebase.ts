import {
  COLLECTIONS,
  DOC_FIELDS,
  applyEffectivePatch,
  type DiagramPatch,
  type DiagramState,
  type Entity,
  type EntityPatch,
} from "@collab-protocol";

/**
 * Optimistic local editing over a server-ordered room.
 *
 *   confirmed  the room's state at `version`, built only from entries
 *   sent       local patches already sent and not yet confirmed or refused, oldest first
 *   unsent     local changes captured but not sent yet (at most one, coalesced)
 *   visible    confirmed + sent + unsent — what the editor shows
 *
 * A remote entry advances `confirmed`; the local patches are re-applied on top, so the user's own
 * in-flight edits never snap back to an older value. A local patch leaves `sent` when its entry
 * arrives (whatever part of it took effect is now in `confirmed`) or when the relay refuses it.
 *
 * Everything here is pure; `StoreBridge` owns the instance and talks to the store and socket.
 */

export interface SentOp {
  opId: string;
  patch: DiagramPatch;
}

export interface SyncState {
  version: number;
  confirmed: DiagramState;
  sent: SentOp[];
  unsent: DiagramPatch | null;
}

export function initialSync(state: DiagramState, version: number): SyncState {
  return { version, confirmed: state, sent: [], unsent: null };
}

function same(a: unknown, b: unknown): boolean {
  if (a === b) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  return JSON.stringify(a) === JSON.stringify(b);
}

function diffEntity(before: Entity, after: Entity): EntityPatch | undefined {
  const set: Entity = {};
  const unset: string[] = [];
  for (const [field, value] of Object.entries(after)) {
    if (value === undefined) continue;
    if (!Object.prototype.hasOwnProperty.call(before, field) || !same(before[field], value)) {
      set[field] = value;
    }
  }
  for (const [field, value] of Object.entries(before)) {
    if (value === undefined) continue;
    if (!Object.prototype.hasOwnProperty.call(after, field) || after[field] === undefined) {
      unset.push(field);
    }
  }
  if (Object.keys(set).length === 0 && unset.length === 0) return undefined;
  const out: { set?: Entity; unset?: string[] } = {};
  if (Object.keys(set).length > 0) out.set = set;
  if (unset.length > 0) out.unset = unset;
  return out;
}

/** Field-level difference from `before` to `after`, or null when nothing synchronised changed. */
export function diffStates(before: DiagramState, after: DiagramState): DiagramPatch | null {
  const patch: DiagramPatch = {};

  for (const field of DOC_FIELDS) {
    if (field === "diagramId") continue;
    const a = before.doc[field] ?? null;
    const b = after.doc[field] ?? null;
    if (!same(a, b)) (patch.doc ??= {})[field] = b;
  }

  for (const collection of COLLECTIONS) {
    const a = before.entities[collection];
    const b = after.entities[collection];
    if (a === b) continue;
    const byId: Record<string, EntityPatch> = {};
    for (const [id, entity] of Object.entries(b)) {
      const previous = a[id];
      if (previous === entity) continue;
      if (!previous) {
        byId[id] = { set: stripUndefined(entity) };
        continue;
      }
      const change = diffEntity(previous, entity);
      if (change !== undefined) byId[id] = change;
    }
    for (const id of Object.keys(a)) {
      if (!Object.prototype.hasOwnProperty.call(b, id)) byId[id] = null;
    }
    if (Object.keys(byId).length > 0) (patch.entities ??= {})[collection] = byId;
  }

  return patch.doc || patch.entities ? patch : null;
}

function stripUndefined(entity: Entity): Entity {
  const out: Entity = {};
  for (const [field, value] of Object.entries(entity)) if (value !== undefined) out[field] = value;
  return out;
}

/** Confirmed state plus every local patch already sent. */
export function sentBase(sync: SyncState): DiagramState {
  return sync.sent.reduce((state, op) => applyEffectivePatch(state, op.patch), sync.confirmed);
}

export function visibleState(sync: SyncState): DiagramState {
  const base = sentBase(sync);
  return sync.unsent ? applyEffectivePatch(base, sync.unsent) : base;
}

/** Record what the editor now holds as the (coalesced) unsent local change. */
export function captureLocal(sync: SyncState, editor: DiagramState): SyncState {
  const unsent = diffStates(sentBase(sync), editor);
  if (unsent === sync.unsent) return sync;
  return { ...sync, unsent };
}

/** Move the unsent change to `sent` under `opId`. */
export function markSent(sync: SyncState, opId: string): { sync: SyncState; op: SentOp | null } {
  if (!sync.unsent) return { sync, op: null };
  const op = { opId, patch: sync.unsent };
  return { sync: { ...sync, sent: [...sync.sent, op], unsent: null }, op };
}

/** Apply a remote (or own, confirmed) entry. */
export function applyEntry(
  sync: SyncState,
  entry: { version: number; opId: string; patch: DiagramPatch },
): SyncState {
  if (entry.version <= sync.version) return sync;
  return {
    ...sync,
    version: entry.version,
    confirmed: applyEffectivePatch(sync.confirmed, entry.patch),
    sent: sync.sent.filter((op) => op.opId !== entry.opId),
  };
}

/** The relay applied nothing of `opId`: forget it, which reverts it in `visible`. */
export function refuseOp(sync: SyncState, opId: string): SyncState {
  if (!sync.sent.some((op) => op.opId === opId)) return sync;
  return { ...sync, sent: sync.sent.filter((op) => op.opId !== opId) };
}

/** True when nothing local is waiting, so `confirmed` is exactly the room at `version`. */
export function isSettled(sync: SyncState): boolean {
  return sync.sent.length === 0 && sync.unsent === null;
}
