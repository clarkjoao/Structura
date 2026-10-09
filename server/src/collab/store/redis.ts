import { createHash, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Redis } from "ioredis";
import {
  COLLECTIONS,
  IMMUTABLE_DOC_FIELDS,
  isCollectionName,
  isDiagramState,
  isDocField,
  isRecord,
  LOCK_GUARDED_FIELDS,
  type CollabUser,
  type DiagramPatch,
  type DiagramState,
  type Entity,
  type Entry,
  type Participant,
  type SessionCloseReason,
} from "../protocol.js";
import { encodeValue } from "../merge.js";
import { CLOSED_ROOM_TTL_MS, ENTRY_LOG_LIMIT } from "./memory.js";
import type {
  AddMemberResult,
  ApplyResult,
  CommitResult,
  PresenceEvent,
  RoomEvent,
  RoomMeta,
  RoomStore,
  Unsubscribe,
} from "./types.js";

/**
 * RoomStore on Redis: any number of relays share rooms through it. Layout (every key of a room
 * carries the `{roomId}` hash tag, so a room lives in one slot):
 *
 *   c:{r}:meta             Hash    status, version, epoch, hostTokenHash, hostUser, seedChunks, createdAt, hostOnline
 *   c:{r}:doc              Hash    doc field → JSON
 *   c:{r}:idx:<coll>       Set     entity ids
 *   c:{r}:e:<coll>:<id>    Hash    field → JSON ("" is a presence marker)
 *   c:{r}:tomb             Hash    <coll>/<id> → version of the removal
 *   c:{r}:ops              Stream  id <version>-0: kind=entry opId sender patch; <version>-1: kind=closed reason
 *   c:{r}:lock:<id>        String  holder, PX ttl
 *   c:{r}:seed             Hash    chunk index → text
 *   c:{r}:members          Hash    clientId → "<expiresAt>|<connId>|<participant>"
 *   c:{r}:presence         channel ephemeral events
 *   collab:hostlease       ZSet    roomId → host lease expiry
 *
 * An optional namespace is prepended to every key, so several deployments (or test runs) can
 * share one Redis without seeing each other's rooms.
 *
 * The merge itself is apply.lua, held to merge.ts by the shared fixture suite.
 */

const READ_BLOCK_MS = 100;
/** Entities written per seed-commit call: bounds how long one call holds Redis. */
const SEED_BATCH_ENTITIES = 200;

type ScriptName =
  "apply" | "seed-commit" | "snapshot" | "close" | "discard" | "members" | "lock" | "host-offline";

const SCRIPTS: Record<ScriptName, string> = Object.fromEntries(
  (
    [
      "apply",
      "seed-commit",
      "snapshot",
      "close",
      "discard",
      "members",
      "lock",
      "host-offline",
    ] as ScriptName[]
  ).map((name) => [name, readFileSync(new URL(`./lua/${name}.lua`, import.meta.url), "utf8")]),
) as Record<ScriptName, string>;

// ── Wire form: values travel to Lua JSON-encoded, so Lua never re-encodes ──

type WireField = [string, string];
type WireEntity = [string, string, 0 | 1, WireField[], string[]];
interface WirePatch {
  doc: WireField[];
  ent: WireEntity[];
}

/** cjson encodes an empty Lua table as `{}`; read either shape as a list. */
function asList<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function toWire(patch: DiagramPatch): WirePatch {
  const doc: WireField[] = Object.entries(patch.doc ?? {}).map(([f, v]) => [f, encodeValue(v)]);
  const ent: WireEntity[] = [];
  for (const collection of COLLECTIONS) {
    for (const [id, entityPatch] of Object.entries(patch.entities?.[collection] ?? {})) {
      if (entityPatch === null) {
        ent.push([collection, id, 1, [], []]);
        continue;
      }
      ent.push([
        collection,
        id,
        0,
        Object.entries(entityPatch.set ?? {}).map(([f, v]) => [f, encodeValue(v)]),
        entityPatch.unset ?? [],
      ]);
    }
  }
  return { doc, ent };
}

function fromWire(text: string): DiagramPatch {
  const wire: unknown = JSON.parse(text);
  if (!isRecord(wire)) return {};
  const patch: DiagramPatch = {};
  for (const [field, enc] of asList<WireField>(wire.doc)) {
    if (!isDocField(field)) continue;
    (patch.doc ??= {})[field] = JSON.parse(enc);
  }
  for (const [collection, id, del, sets, unsets] of asList<WireEntity>(wire.ent)) {
    if (!isCollectionName(collection)) continue;
    const byId = ((patch.entities ??= {})[collection] ??= {});
    if (del === 1) {
      byId[id] = null;
      continue;
    }
    const out: { set?: Entity; unset?: string[] } = {};
    const setList = asList<WireField>(sets);
    const unsetList = asList<string>(unsets);
    if (setList.length > 0)
      out.set = Object.fromEntries(setList.map(([f, enc]) => [f, JSON.parse(enc)]));
    if (unsetList.length > 0) out.unset = unsetList;
    byId[id] = out;
  }
  return patch;
}

function flatToEntity(flat: unknown): Entity {
  const list = asList<string>(flat);
  const entity: Entity = {};
  for (let i = 0; i + 1 < list.length; i += 2) {
    if (list[i] === "") continue;
    entity[list[i]] = JSON.parse(list[i + 1]);
  }
  return entity;
}

function streamFields(fields: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i + 1 < fields.length; i += 2) out[fields[i]] = fields[i + 1];
  return out;
}

function versionOfId(id: string): number {
  return Number(id.split("-")[0]);
}

function toEntry(id: string, fields: string[]): RoomEvent | null {
  const f = streamFields(fields);
  if (f.kind === "closed") {
    return f.reason === "host_closed" || f.reason === "host_timeout"
      ? { kind: "closed", reason: f.reason }
      : null;
  }
  if (f.kind !== "entry") return null;
  return {
    kind: "entry",
    entry: { version: versionOfId(id), opId: f.opId, sender: f.sender, patch: fromWire(f.patch) },
  };
}

function parseMember(value: string): {
  expiresAt: number;
  connId: string;
  participant: Participant;
} {
  const first = value.indexOf("|");
  const second = value.indexOf("|", first + 1);
  return {
    expiresAt: Number(value.slice(0, first)),
    connId: value.slice(first + 1, second),
    participant: JSON.parse(value.slice(second + 1)) as Participant,
  };
}

interface StreamWatch {
  lastId: string;
  listeners: Set<(event: RoomEvent) => void>;
}

export class RedisRoomStore implements RoomStore {
  readonly kind = "redis" as const;
  private readonly cmd: Redis;
  private readonly reader: Redis;
  private readonly sub: Redis;
  private readonly shas = new Map<ScriptName, string>();
  private readonly watches = new Map<string, StreamWatch>();
  private readonly presence = new Map<string, Set<(event: PresenceEvent) => void>>();
  private readLoop: Promise<void> | null = null;
  private readonly now: () => number;
  private closed = false;

  private readonly hostLeaseKey: string;
  private readonly namespace: string;

  constructor(url: string, options: { namespace?: string; now?: () => number } = {}) {
    this.namespace = options.namespace ?? "";
    this.now = options.now ?? Date.now;
    this.hostLeaseKey = `${this.namespace}collab:hostlease`;
    this.cmd = new Redis(url, { maxRetriesPerRequest: null, enableAutoPipelining: true });
    this.reader = new Redis(url, { maxRetriesPerRequest: null });
    // No ready check: on a reconnect it would send INFO on a connection still in subscriber mode.
    this.sub = new Redis(url, { maxRetriesPerRequest: null, enableReadyCheck: false });
    for (const [role, connection] of [
      ["commands", this.cmd],
      ["reader", this.reader],
      ["presence", this.sub],
    ] as const) {
      // ioredis reconnects on its own; an error event with no listener would crash the relay.
      connection.on("error", (err: Error) => this.reportError(role, err));
    }
    this.sub.on("message", (channel: string, message: string) =>
      this.onPresenceMessage(channel, message),
    );
    for (const name of Object.keys(SCRIPTS) as ScriptName[]) {
      this.shas.set(name, createHash("sha1").update(SCRIPTS[name]).digest("hex"));
    }
  }

  private prefix(roomId: string): string {
    return `${this.namespace}c:{${roomId}}`;
  }

  private lastErrorLog = 0;
  private reportError(role: string, err: Error): void {
    if (this.closed) return;
    const now = Date.now();
    if (now - this.lastErrorLog < 5_000) return;
    this.lastErrorLog = now;
    console.warn(`[collab] redis ${role} connection: ${err.message}`);
  }

  /** Run a script by hash, loading it on first use or after a Redis restart. */
  private async run(name: ScriptName, args: Array<string | number>): Promise<unknown> {
    const sha = this.shas.get(name) as string;
    try {
      return await this.cmd.evalsha(sha, 0, ...args);
    } catch (err) {
      if (err instanceof Error && err.message.includes("NOSCRIPT")) {
        return this.cmd.eval(SCRIPTS[name], 0, ...args);
      }
      throw err;
    }
  }

  async createRoom(input: {
    roomId: string;
    hostTokenHash: string;
    hostUser: CollabUser;
    seedChunks: number;
    now: number;
  }): Promise<"created" | "exists"> {
    const meta = `${this.prefix(input.roomId)}:meta`;
    const created = await this.cmd.hsetnx(meta, "status", "seeding");
    if (created === 0) return "exists";
    await this.cmd.hset(meta, {
      version: 0,
      hostTokenHash: input.hostTokenHash,
      hostUser: JSON.stringify(input.hostUser),
      seedChunks: input.seedChunks,
      createdAt: input.now,
      hostOnline: "1",
      epoch: randomUUID(),
    });
    await this.cmd.zadd(this.hostLeaseKey, input.now, input.roomId);
    return "created";
  }

  async appendSeedChunk(roomId: string, index: number, data: string): Promise<void> {
    await this.cmd.hset(`${this.prefix(roomId)}:seed`, String(index), data);
  }

  async commitSeed(roomId: string): Promise<CommitResult> {
    const meta = await this.getMeta(roomId);
    if (!meta || meta.status !== "seeding") return { ok: false, code: "not_seeding" };
    const chunks = await this.cmd.hgetall(`${this.prefix(roomId)}:seed`);
    const parts: string[] = [];
    for (let i = 0; i < meta.seedChunks; i++) {
      const part = chunks[String(i)];
      if (part === undefined) return { ok: false, code: "invalid_seed" };
      parts.push(part);
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(parts.join(""));
    } catch {
      return { ok: false, code: "invalid_seed" };
    }
    if (!isDiagramState(parsed)) return { ok: false, code: "invalid_seed" };

    const state: DiagramState = parsed;
    const doc = Object.entries(state.doc).map(([f, v]) => [f, encodeValue(v)]);
    const ent = COLLECTIONS.flatMap((collection) =>
      Object.entries(state.entities[collection]).map(([id, entity]) => [
        collection,
        id,
        Object.entries(entity).map(([f, v]) => [f, encodeValue(v)]),
      ]),
    );
    // Batches keep each script call short; the room opens with the last one.
    const batches = Math.max(1, Math.ceil(ent.length / SEED_BATCH_ENTITIES));
    for (let b = 0; b < batches; b++) {
      const batch = {
        doc: b === 0 ? doc : [],
        ent: ent.slice(b * SEED_BATCH_ENTITIES, (b + 1) * SEED_BATCH_ENTITIES),
      };
      const last = b === batches - 1;
      const written = await this.run("seed-commit", [
        this.prefix(roomId),
        JSON.stringify(batch),
        last ? "1" : "0",
      ]);
      if (written !== 1) return { ok: false, code: "not_seeding" };
    }
    return { ok: true };
  }

  async discardRoom(roomId: string): Promise<void> {
    await this.run("discard", [
      this.prefix(roomId),
      JSON.stringify(COLLECTIONS),
      roomId,
      this.hostLeaseKey,
    ]);
  }

  async getMeta(roomId: string): Promise<RoomMeta | null> {
    const raw = await this.cmd.hgetall(`${this.prefix(roomId)}:meta`);
    if (!raw.status) return null;
    const status = raw.status === "open" || raw.status === "closed" ? raw.status : "seeding";
    return {
      roomId,
      status,
      version: Number(raw.version ?? 0),
      hostTokenHash: raw.hostTokenHash ?? "",
      hostUser: JSON.parse(raw.hostUser ?? "null") as CollabUser,
      seedChunks: Number(raw.seedChunks ?? 0),
      createdAt: Number(raw.createdAt ?? 0),
      epoch: raw.epoch ?? "",
    };
  }

  async applyPatch(
    roomId: string,
    input: { patch: DiagramPatch; senderVersion: number; senderId: string; opId: string },
  ): Promise<ApplyResult> {
    const result = asList<unknown>(
      await this.run("apply", [
        this.prefix(roomId),
        JSON.stringify(toWire(input.patch)),
        input.senderVersion,
        input.senderId,
        input.opId,
        JSON.stringify(LOCK_GUARDED_FIELDS),
        JSON.stringify([...IMMUTABLE_DOC_FIELDS]),
        ENTRY_LOG_LIMIT,
      ]),
    );
    if (result[0] === "applied") {
      return {
        status: "applied",
        version: Number(result[1]),
        effective: fromWire(String(result[2])),
      };
    }
    if (result[0] === "noop") return { status: "noop", version: Number(result[1]) };
    return { status: "not_open" };
  }

  async readSnapshot(roomId: string): Promise<{ version: number; state: DiagramState } | null> {
    const raw = await this.run("snapshot", [this.prefix(roomId), JSON.stringify(COLLECTIONS)]);
    if (!Array.isArray(raw)) return null;
    const [version, docFlat, collections] = raw as [number, unknown, unknown];
    const doc = flatToEntity(docFlat) as DiagramState["doc"];
    const entities = {} as DiagramState["entities"];
    for (const collection of COLLECTIONS) entities[collection] = {};
    for (const [collection, list] of asList<[string, unknown]>(collections)) {
      if (!isCollectionName(collection)) continue;
      for (const [id, flat] of asList<[string, unknown]>(list)) {
        entities[collection][id] = flatToEntity(flat);
      }
    }
    return { version: Number(version), state: { doc, entities } };
  }

  async readEntries(roomId: string, fromVersion: number): Promise<Entry[] | null> {
    const meta = await this.getMeta(roomId);
    if (!meta || meta.status !== "open") return null;
    if (fromVersion > meta.version) return null;
    if (fromVersion === meta.version) return [];
    const rows = await this.cmd.xrange(`${this.prefix(roomId)}:ops`, `(${fromVersion}-0`, "+");
    const entries: Entry[] = [];
    for (const [id, fields] of rows) {
      const event = toEntry(id, fields);
      if (event?.kind === "entry") entries.push(event.entry);
    }
    if (entries.length === 0 || entries[0].version !== fromVersion + 1) return null;
    return entries;
  }

  async subscribe(roomId: string, listener: (event: RoomEvent) => void): Promise<Unsubscribe> {
    let watch = this.watches.get(roomId);
    if (!watch) {
      const version = Number((await this.cmd.hget(`${this.prefix(roomId)}:meta`, "version")) ?? 0);
      watch = this.watches.get(roomId) ?? { lastId: `${version}-0`, listeners: new Set() };
      this.watches.set(roomId, watch);
    }
    watch.listeners.add(listener);
    this.ensureReadLoop();
    return () => {
      const current = this.watches.get(roomId);
      if (!current) return;
      current.listeners.delete(listener);
      if (current.listeners.size === 0) this.watches.delete(roomId);
    };
  }

  /** One blocking reader per store fans every watched room's stream out, in stream order. */
  private ensureReadLoop(): void {
    if (this.readLoop || this.closed) return;
    this.readLoop = (async () => {
      while (!this.closed && this.watches.size > 0) {
        const rooms = [...this.watches.keys()];
        const keys = rooms.map((roomId) => `${this.prefix(roomId)}:ops`);
        const ids = rooms.map((roomId) => (this.watches.get(roomId) as StreamWatch).lastId);
        let result: Array<[string, Array<[string, string[]]>]> | null;
        try {
          result = (await this.reader.xread(
            "COUNT",
            1000,
            "BLOCK",
            READ_BLOCK_MS,
            "STREAMS",
            ...keys,
            ...ids,
          )) as Array<[string, Array<[string, string[]]>]> | null;
        } catch {
          if (this.closed) break;
          await new Promise((resolve) => setTimeout(resolve, 100));
          continue;
        }
        for (const [key, rows] of result ?? []) {
          const roomId = rooms[keys.indexOf(key)];
          const watch = this.watches.get(roomId);
          if (!watch) continue;
          for (const [id, fields] of rows) {
            watch.lastId = id;
            const event = toEntry(id, fields);
            if (!event) continue;
            for (const listener of [...watch.listeners]) listener(event);
          }
        }
      }
      this.readLoop = null;
      if (!this.closed && this.watches.size > 0) this.ensureReadLoop();
    })();
  }

  async addMember(
    roomId: string,
    member: Participant,
    connId: string,
    expiresAt: number,
    maxParticipants: number,
    now: number,
  ): Promise<AddMemberResult> {
    const [ok, count] = asList<number>(
      await this.run("members", [
        `${this.prefix(roomId)}:members`,
        "add",
        now,
        member.clientId,
        connId,
        expiresAt,
        maxParticipants,
        JSON.stringify(member),
      ]),
    );
    return ok === 1 ? { ok: true, count: Number(count) } : { ok: false, reason: "full" };
  }

  async touchMembers(roomId: string, clientIds: string[], expiresAt: number): Promise<void> {
    if (clientIds.length === 0) return;
    await this.run("members", [
      `${this.prefix(roomId)}:members`,
      "touch",
      this.now(),
      expiresAt,
      ...clientIds,
    ]);
  }

  async removeMember(
    roomId: string,
    clientId: string,
    connId: string,
    now: number,
  ): Promise<number> {
    return Number(
      await this.run("members", [
        `${this.prefix(roomId)}:members`,
        "remove",
        now,
        clientId,
        connId,
      ]),
    );
  }

  async listMembers(roomId: string, now: number): Promise<Participant[]> {
    const raw = await this.cmd.hgetall(`${this.prefix(roomId)}:members`);
    return Object.values(raw)
      .map(parseMember)
      .filter((m) => m.expiresAt > now)
      .map((m) => m.participant);
  }

  async acquireLock(
    roomId: string,
    entityId: string,
    clientId: string,
    ttlMs: number,
  ): Promise<{ granted: boolean; holder: string | null }> {
    const [granted, holder] = asList<number | string>(
      await this.run("lock", [
        `${this.prefix(roomId)}:lock:${entityId}`,
        "acquire",
        clientId,
        ttlMs,
      ]),
    );
    return { granted: granted === 1, holder: typeof holder === "string" ? holder : null };
  }

  async releaseLock(roomId: string, entityId: string, clientId: string): Promise<boolean> {
    return (
      (await this.run("lock", [`${this.prefix(roomId)}:lock:${entityId}`, "release", clientId])) ===
      1
    );
  }

  async renewHostLease(roomId: string, expiresAt: number): Promise<void> {
    const status = await this.cmd.hget(`${this.prefix(roomId)}:meta`, "status");
    if (status === null || status === "closed") return;
    await this.cmd.zadd(this.hostLeaseKey, expiresAt, roomId);
  }

  async expiredHostLeases(before: number): Promise<string[]> {
    const rooms = await this.cmd.zrangebyscore(this.hostLeaseKey, "-inf", `(${before}`);
    const live: string[] = [];
    for (const roomId of rooms) {
      const status = await this.cmd.hget(`${this.prefix(roomId)}:meta`, "status");
      if (status === null || status === "closed") await this.cmd.zrem(this.hostLeaseKey, roomId);
      else live.push(roomId);
    }
    return live;
  }

  async markHostOffline(roomId: string): Promise<boolean> {
    return (await this.run("host-offline", [`${this.prefix(roomId)}:meta`])) === 1;
  }

  async markHostOnline(roomId: string): Promise<void> {
    const meta = `${this.prefix(roomId)}:meta`;
    if ((await this.cmd.exists(meta)) === 1) await this.cmd.hset(meta, "hostOnline", "1");
  }

  async isHostOnline(roomId: string): Promise<boolean> {
    return (await this.cmd.hget(`${this.prefix(roomId)}:meta`, "hostOnline")) === "1";
  }

  async closeRoom(roomId: string, reason: SessionCloseReason): Promise<boolean> {
    const closed = await this.run("close", [
      this.prefix(roomId),
      reason,
      JSON.stringify(COLLECTIONS),
      CLOSED_ROOM_TTL_MS,
      roomId,
      this.hostLeaseKey,
    ]);
    return closed === 1;
  }

  async publishPresence(roomId: string, event: PresenceEvent): Promise<void> {
    await this.cmd.publish(`${this.prefix(roomId)}:presence`, JSON.stringify(event));
  }

  async subscribePresence(
    roomId: string,
    listener: (event: PresenceEvent) => void,
  ): Promise<Unsubscribe> {
    const channel = `${this.prefix(roomId)}:presence`;
    let listeners = this.presence.get(channel);
    if (!listeners) {
      listeners = new Set();
      this.presence.set(channel, listeners);
      await this.sub.subscribe(channel);
    }
    listeners.add(listener);
    return () => {
      const current = this.presence.get(channel);
      if (!current) return;
      current.delete(listener);
      if (current.size === 0) {
        this.presence.delete(channel);
        void this.sub.unsubscribe(channel).catch(() => {});
      }
    };
  }

  private onPresenceMessage(channel: string, message: string): void {
    const listeners = this.presence.get(channel);
    if (!listeners) return;
    let event: PresenceEvent;
    try {
      event = JSON.parse(message) as PresenceEvent;
    } catch {
      return;
    }
    for (const listener of [...listeners]) listener(event);
  }

  async close(): Promise<void> {
    this.closed = true;
    this.watches.clear();
    this.presence.clear();
    await Promise.allSettled([this.cmd.quit(), this.sub.quit()]);
    this.reader.disconnect();
    await this.readLoop?.catch(() => {});
  }
}
