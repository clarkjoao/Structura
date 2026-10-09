/**
 * Collaboration protocol v3 — the wire contract shared by the relay and the browser client.
 *
 * This file is imported by both sides (the client through the `@collab-protocol` alias), so it
 * must stay dependency-free and runtime-neutral: no Node or DOM APIs, no imports.
 *
 * The full specification lives in docs/collab-protocol-v3.md.
 */

export const COLLAB_PROTOCOL_VERSION = 3;

/** Keyed entity collections of a diagram. Each entity is a flat record merged field by field. */
export const COLLECTIONS = [
  "components",
  "connections",
  "flows",
  "iconLibrary",
  "nodeLayouts",
  "edgeLayouts",
  "versions",
] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

/** Top-level scalar fields of a diagram, assigned whole. */
export const DOC_FIELDS = [
  "diagramId",
  "diagramName",
  "level",
  "domain",
  "description",
  "activeVersionId",
  "compareVersionId",
] as const;
export type DocField = (typeof DOC_FIELDS)[number];

/** Doc fields fixed at seed time; a patch may not change them. */
export const IMMUTABLE_DOC_FIELDS: ReadonlySet<string> = new Set(["diagramId"]);

/**
 * Fields only the holder of an entity's soft lock may write. Everything else is
 * last-writer-wins per field.
 */
export const LOCK_GUARDED_FIELDS: Readonly<Partial<Record<CollectionName, readonly string[]>>> = {
  nodeLayouts: ["x", "y", "width", "height"],
  components: ["name", "description"],
  connections: ["label", "description"],
};

export const LIMITS = {
  maxParticipants: 50,
  /** Any single frame, in UTF-16 code units of its text. */
  maxFrameChars: 256 * 1024,
  /** Seed and snapshot chunk payloads. */
  chunkChars: 64 * 1024,
  maxSeedChars: 8 * 1024 * 1024,
  lockTtlMs: 3_000,
  hostGraceMs: 30_000,
} as const;

// ── Diagram state and patches ──────────────────────────────────────────────

export type Entity = Record<string, unknown>;
export type EntityMap = Record<string, Entity>;

export interface DiagramState {
  doc: Partial<Record<DocField, unknown>>;
  entities: Record<CollectionName, EntityMap>;
}

/**
 * Change to one entity: `null` removes it; otherwise `set` assigns fields and `unset` removes
 * fields. A field set to `null` keeps the value `null` — removal is only ever explicit.
 */
export type EntityPatch = { set?: Entity; unset?: string[] } | null;

export interface DiagramPatch {
  doc?: Partial<Record<DocField, unknown>>;
  entities?: Partial<Record<CollectionName, Record<string, EntityPatch>>>;
}

/** One accepted, ordered change: what every participant applies, in version order. */
export interface Entry {
  version: number;
  opId: string;
  sender: string;
  patch: DiagramPatch;
}

export interface CollabUser {
  id: string;
  name: string;
  color: string;
}

export interface Participant {
  clientId: string;
  user: CollabUser;
  role: "host" | "guest";
}

export interface CursorEntry {
  clientId: string;
  cursor: { x: number; y: number } | null;
  activeElementId: string | null;
}

// ── Messages: client → server ──────────────────────────────────────────────

export type ClientMessage =
  | {
      type: "create";
      protocol: number;
      roomId: string;
      user: CollabUser;
      seedChars: number;
      seedChunks: number;
      /** Present only on a reseed after `room_unknown`: the credential the room was created with. */
      hostToken?: string;
    }
  | { type: "seed:chunk"; index: number; data: string }
  | { type: "seed:commit" }
  | {
      type: "join";
      protocol: number;
      roomId: string;
      user: CollabUser;
      /** Present to join as host. */
      hostToken?: string;
      /** Last version this client fully applied; only when its state provably equals it. */
      resumeFrom?: number;
      /** The room incarnation `resumeFrom` belongs to (from `joined.epoch`). */
      resumeEpoch?: string;
    }
  | { type: "patch"; opId: string; baseVersion: number; patch: DiagramPatch }
  | { type: "lock"; action: "acquire" | "renew" | "release"; entityId: string }
  | { type: "cursor"; cursor: { x: number; y: number } | null; activeElementId: string | null }
  | { type: "close" }
  | { type: "ping" }
  | { type: "pong" };

// ── Messages: server → client ──────────────────────────────────────────────

export type SessionCloseReason = "host_closed" | "host_timeout";

export type ErrorCode =
  | "invalid_message"
  | "protocol_mismatch"
  | "not_joined"
  | "already_joined"
  | "unauthorized"
  | "room_unknown"
  | "room_exists"
  | "not_ready"
  | "room_full"
  | "session_closed"
  | "too_large"
  | "invalid_seed"
  | "rate_limited"
  | "unavailable";

export type ServerMessage =
  | { type: "created"; roomId: string; clientId: string; hostToken: string }
  | {
      type: "joined";
      clientId: string;
      role: "host" | "guest";
      version: number;
      participants: Participant[];
      maxParticipants: number;
      hostOnline: boolean;
      /**
       * Identity of this incarnation of the room. A room recreated after a storage loss reuses
       * its id but not its epoch, so versions from the old one are never resumed into it.
       */
      epoch: string;
      /** Present when the resume was served by replay; otherwise a snapshot follows. */
      catchup?: Entry[];
    }
  | { type: "snapshot:chunk"; index: number; total: number; data: string }
  | { type: "snapshot:end"; version: number }
  | ({ type: "entry" } & Entry)
  | { type: "ack"; opId: string; applied: boolean; version: number }
  | { type: "lock:result"; entityId: string; granted: boolean; holder: string | null }
  | { type: "lock"; entityId: string; holder: string | null; ttlMs: number }
  | { type: "cursors"; entries: CursorEntry[] }
  | { type: "peer:joined"; participant: Participant; participantCount: number }
  | { type: "peer:left"; clientId: string; participantCount: number }
  | { type: "host:status"; online: boolean }
  | { type: "session:closed"; reason: SessionCloseReason }
  | { type: "error"; code: ErrorCode; message: string; limit?: number; size?: number }
  | { type: "ping" }
  | { type: "pong" };

// ── Guards ─────────────────────────────────────────────────────────────────

const DANGEROUS_KEYS: ReadonlySet<string> = new Set(["__proto__", "constructor", "prototype"]);

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Room ids end up inside storage keys, so they are restricted to a plain alphabet. */
export function isRoomId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(value) && isSafeKey(value);
}

export function isSafeKey(key: string): boolean {
  return key.length > 0 && key.length <= 256 && !DANGEROUS_KEYS.has(key);
}

const COLLECTION_SET: ReadonlySet<string> = new Set(COLLECTIONS);
const DOC_FIELD_SET: ReadonlySet<string> = new Set(DOC_FIELDS);

export function isCollectionName(value: string): value is CollectionName {
  return COLLECTION_SET.has(value);
}

export function isDocField(value: string): value is DocField {
  return DOC_FIELD_SET.has(value);
}

/** True when no object key anywhere in `value` could pollute a prototype. */
export function hasOnlySafeKeys(value: unknown, depth = 0): boolean {
  if (depth > 64) return false;
  if (Array.isArray(value)) return value.every((item) => hasOnlySafeKeys(item, depth + 1));
  if (!isRecord(value)) return true;
  for (const [key, child] of Object.entries(value)) {
    if (DANGEROUS_KEYS.has(key)) return false;
    if (!hasOnlySafeKeys(child, depth + 1)) return false;
  }
  return true;
}

export function isCollabUser(value: unknown): value is CollabUser {
  return (
    isRecord(value) &&
    typeof value.id === "string" &&
    value.id.length > 0 &&
    value.id.length <= 128 &&
    typeof value.name === "string" &&
    value.name.length <= 128 &&
    typeof value.color === "string" &&
    value.color.length <= 32
  );
}

function isEntityPatch(value: unknown): value is EntityPatch {
  if (value === null) return true;
  if (!isRecord(value)) return false;
  for (const key of Object.keys(value)) if (key !== "set" && key !== "unset") return false;
  if (value.set !== undefined) {
    if (!isRecord(value.set)) return false;
    for (const field of Object.keys(value.set)) if (!isSafeKey(field)) return false;
    if (!hasOnlySafeKeys(value.set)) return false;
  }
  if (value.unset !== undefined) {
    if (!Array.isArray(value.unset)) return false;
    for (const field of value.unset)
      if (typeof field !== "string" || !isSafeKey(field)) return false;
  }
  return true;
}

export function isDiagramPatch(value: unknown): value is DiagramPatch {
  if (!isRecord(value)) return false;
  for (const key of Object.keys(value)) if (key !== "doc" && key !== "entities") return false;
  if (value.doc !== undefined) {
    if (!isRecord(value.doc)) return false;
    for (const field of Object.keys(value.doc)) if (!isDocField(field)) return false;
    if (!hasOnlySafeKeys(value.doc)) return false;
  }
  if (value.entities !== undefined) {
    if (!isRecord(value.entities)) return false;
    for (const [collection, byId] of Object.entries(value.entities)) {
      if (!isCollectionName(collection) || !isRecord(byId)) return false;
      for (const [entityId, entityPatch] of Object.entries(byId)) {
        if (!isSafeKey(entityId) || !isEntityPatch(entityPatch)) return false;
      }
    }
  }
  return true;
}

export function isDiagramState(value: unknown): value is DiagramState {
  if (!isRecord(value) || !isRecord(value.doc) || !isRecord(value.entities)) return false;
  for (const field of Object.keys(value.doc)) if (!isDocField(field)) return false;
  for (const collection of COLLECTIONS) {
    const byId = value.entities[collection];
    if (!isRecord(byId)) return false;
    for (const [entityId, entity] of Object.entries(byId)) {
      if (!isSafeKey(entityId) || !isRecord(entity)) return false;
    }
  }
  return hasOnlySafeKeys(value);
}

export function isEntry(value: unknown): value is Entry {
  return (
    isRecord(value) &&
    typeof value.version === "number" &&
    typeof value.opId === "string" &&
    typeof value.sender === "string" &&
    isDiagramPatch(value.patch)
  );
}

function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

function isCursor(value: unknown): value is { x: number; y: number } | null {
  return (
    value === null || (isRecord(value) && Number.isFinite(value.x) && Number.isFinite(value.y))
  );
}

/** Parse and validate one inbound frame. Returns null for anything that is not a v3 message. */
export function parseClientMessage(raw: string): ClientMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }
  if (!isRecord(value) || typeof value.type !== "string") return null;

  switch (value.type) {
    case "create":
      return typeof value.protocol === "number" &&
        isRoomId(value.roomId) &&
        isCollabUser(value.user) &&
        Number.isInteger(value.seedChars) &&
        Number.isInteger(value.seedChunks) &&
        isOptionalString(value.hostToken)
        ? (value as ClientMessage)
        : null;
    case "seed:chunk":
      return Number.isInteger(value.index) && typeof value.data === "string"
        ? (value as ClientMessage)
        : null;
    case "seed:commit":
    case "close":
    case "ping":
    case "pong":
      return { type: value.type };
    case "join":
      return typeof value.protocol === "number" &&
        isRoomId(value.roomId) &&
        isCollabUser(value.user) &&
        isOptionalString(value.hostToken) &&
        isOptionalString(value.resumeEpoch) &&
        (value.resumeFrom === undefined ||
          (Number.isInteger(value.resumeFrom) && (value.resumeFrom as number) >= 0))
        ? (value as ClientMessage)
        : null;
    case "patch":
      return typeof value.opId === "string" &&
        value.opId.length > 0 &&
        value.opId.length <= 128 &&
        Number.isInteger(value.baseVersion) &&
        isDiagramPatch(value.patch)
        ? (value as ClientMessage)
        : null;
    case "lock":
      return (value.action === "acquire" ||
        value.action === "renew" ||
        value.action === "release") &&
        typeof value.entityId === "string" &&
        isSafeKey(value.entityId)
        ? (value as ClientMessage)
        : null;
    case "cursor":
      return "cursor" in value &&
        isCursor(value.cursor) &&
        (value.activeElementId === null || typeof value.activeElementId === "string")
        ? (value as ClientMessage)
        : null;
    default:
      return null;
  }
}

// ── State helpers shared by both sides ─────────────────────────────────────

export function emptyDiagramState(): DiagramState {
  const entities = {} as Record<CollectionName, EntityMap>;
  for (const collection of COLLECTIONS) entities[collection] = {};
  return { doc: {}, entities };
}

/**
 * Apply an already-accepted patch (an entry's effective patch) to a state, immutably.
 * Untouched collections and entities keep their identity.
 */
export function applyEffectivePatch(state: DiagramState, patch: DiagramPatch): DiagramState {
  let doc = state.doc;
  if (patch.doc && Object.keys(patch.doc).length > 0) doc = { ...state.doc, ...patch.doc };

  let entities = state.entities;
  if (patch.entities) {
    for (const collection of COLLECTIONS) {
      const byId = patch.entities[collection];
      if (!byId) continue;
      const next: EntityMap = { ...entities[collection] };
      for (const [entityId, entityPatch] of Object.entries(byId)) {
        if (entityPatch === null) {
          delete next[entityId];
          continue;
        }
        const merged: Entity = { ...(next[entityId] ?? {}), ...(entityPatch.set ?? {}) };
        for (const field of entityPatch.unset ?? []) delete merged[field];
        next[entityId] = merged;
      }
      if (entities === state.entities) entities = { ...state.entities };
      entities[collection] = next;
    }
  }

  return doc === state.doc && entities === state.entities ? state : { doc, entities };
}

export function isEmptyPatch(patch: DiagramPatch): boolean {
  if (patch.doc && Object.keys(patch.doc).length > 0) return false;
  if (!patch.entities) return true;
  return Object.values(patch.entities).every((byId) => !byId || Object.keys(byId).length === 0);
}

/** Split a string into fixed-size chunks (at least one, possibly empty). */
export function chunkString(text: string, size: number = LIMITS.chunkChars): string[] {
  if (text.length === 0) return [""];
  const chunks: string[] = [];
  for (let i = 0; i < text.length; i += size) chunks.push(text.slice(i, i + size));
  return chunks;
}
