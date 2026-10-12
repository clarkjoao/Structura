import { randomUUID } from "node:crypto";
import { mergePatch } from "../merge.js";
import {
  emptyDiagramState,
  isDiagramState,
  isEmptyPatch,
  type DiagramState,
  type Entry,
  type Participant,
  type SessionCloseReason,
} from "../protocol.js";
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

/** How many entries a room keeps for resume. Older resumes get the snapshot. */
export const ENTRY_LOG_LIMIT = 2_000;
/** Bound on remembered removals; the oldest are forgotten first. */
export const TOMBSTONE_LIMIT = 10_000;
/** A closed room lingers this long so late reconnects learn it closed rather than vanished. */
export const CLOSED_ROOM_TTL_MS = 60_000;

interface MemoryRoom {
  meta: RoomMeta;
  seed: string[];
  state: DiagramState;
  tombstones: Map<string, number>;
  log: Entry[];
  members: Map<string, { participant: Participant; connId: string; expiresAt: number }>;
  locks: Map<string, { holder: string; expiresAt: number }>;
  hostLeaseUntil: number;
  hostOnline: boolean;
  listeners: Set<(event: RoomEvent) => void>;
  presenceListeners: Set<(event: PresenceEvent) => void>;
}

/**
 * Single-instance store. It is also the executable reference for `apply.lua`: the contract
 * suite runs the same fixtures against both.
 */
export class MemoryRoomStore implements RoomStore {
  readonly kind = "memory" as const;
  private readonly rooms = new Map<string, MemoryRoom>();
  private readonly timers = new Set<ReturnType<typeof setTimeout>>();

  constructor(private readonly now: () => number = Date.now) {}

  isAvailable(): boolean {
    return true;
  }

  async createRoom(input: {
    roomId: string;
    hostTokenHash: string;
    hostUser: Participant["user"];
    seedChunks: number;
    now: number;
  }): Promise<"created" | "exists"> {
    if (this.rooms.has(input.roomId)) return "exists";
    this.rooms.set(input.roomId, {
      meta: {
        roomId: input.roomId,
        status: "seeding",
        version: 0,
        hostTokenHash: input.hostTokenHash,
        hostUser: input.hostUser,
        seedChunks: input.seedChunks,
        createdAt: input.now,
        epoch: randomUUID(),
      },
      seed: [],
      state: emptyDiagramState(),
      tombstones: new Map(),
      log: [],
      members: new Map(),
      locks: new Map(),
      hostLeaseUntil: 0,
      hostOnline: true,
      listeners: new Set(),
      presenceListeners: new Set(),
    });
    return "created";
  }

  async appendSeedChunk(roomId: string, index: number, data: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room || room.meta.status !== "seeding") return;
    room.seed[index] = data;
  }

  async commitSeed(roomId: string): Promise<CommitResult> {
    const room = this.rooms.get(roomId);
    if (!room || room.meta.status !== "seeding") return { ok: false, code: "not_seeding" };
    for (let i = 0; i < room.meta.seedChunks; i++) {
      if (typeof room.seed[i] !== "string") return { ok: false, code: "invalid_seed" };
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(room.seed.slice(0, room.meta.seedChunks).join(""));
    } catch {
      return { ok: false, code: "invalid_seed" };
    }
    if (!isDiagramState(parsed)) return { ok: false, code: "invalid_seed" };
    room.state = parsed;
    room.seed = [];
    room.meta.status = "open";
    return { ok: true };
  }

  async discardRoom(roomId: string): Promise<void> {
    this.rooms.delete(roomId);
  }

  async getMeta(roomId: string): Promise<RoomMeta | null> {
    const room = this.rooms.get(roomId);
    return room ? { ...room.meta } : null;
  }

  async applyPatch(
    roomId: string,
    input: {
      patch: Entry["patch"];
      senderVersion: number;
      senderId: string;
      opId: string;
    },
  ): Promise<ApplyResult> {
    const room = this.rooms.get(roomId);
    if (!room || room.meta.status !== "open") return { status: "not_open" };

    const nextVersion = room.meta.version + 1;
    const now = this.now();
    const effective = mergePatch(room, input.patch, nextVersion, {
      senderVersion: input.senderVersion,
      senderId: input.senderId,
      lockHolder: (entityId) => {
        const lock = room.locks.get(entityId);
        return lock && lock.expiresAt > now ? lock.holder : null;
      },
    });
    if (isEmptyPatch(effective)) return { status: "noop", version: room.meta.version };

    room.meta.version = nextVersion;
    const entry: Entry = {
      version: nextVersion,
      opId: input.opId,
      sender: input.senderId,
      patch: effective,
    };
    room.log.push(entry);
    if (room.log.length > ENTRY_LOG_LIMIT) room.log.splice(0, room.log.length - ENTRY_LOG_LIMIT);
    if (room.tombstones.size > TOMBSTONE_LIMIT) {
      const excess = room.tombstones.size - TOMBSTONE_LIMIT;
      let i = 0;
      for (const key of room.tombstones.keys()) {
        if (i++ >= excess) break;
        room.tombstones.delete(key);
      }
    }
    this.emit(room, { kind: "entry", entry });
    return { status: "applied", version: nextVersion, effective };
  }

  async readSnapshot(roomId: string): Promise<{ version: number; state: DiagramState } | null> {
    const room = this.rooms.get(roomId);
    if (!room || room.meta.status !== "open") return null;
    // A deep copy, so a caller can never observe later merges through the reference.
    return { version: room.meta.version, state: structuredClone(room.state) };
  }

  async readEntries(roomId: string, fromVersion: number): Promise<Entry[] | null> {
    const room = this.rooms.get(roomId);
    if (!room || room.meta.status !== "open") return null;
    const version = room.meta.version;
    if (fromVersion > version) return null;
    if (fromVersion === version) return [];
    const oldest = room.log[0]?.version;
    if (oldest === undefined || oldest > fromVersion + 1) return null;
    return room.log.filter((entry) => entry.version > fromVersion);
  }

  async subscribe(roomId: string, listener: (event: RoomEvent) => void): Promise<Unsubscribe> {
    const room = this.rooms.get(roomId);
    if (!room) return () => {};
    room.listeners.add(listener);
    return () => {
      room.listeners.delete(listener);
    };
  }

  async addMember(
    roomId: string,
    member: Participant,
    connId: string,
    expiresAt: number,
    maxParticipants: number,
    now: number,
  ): Promise<AddMemberResult> {
    const room = this.rooms.get(roomId);
    if (!room) return { ok: false, reason: "full" };
    this.pruneMembers(room, now);
    if (!room.members.has(member.clientId) && room.members.size >= maxParticipants) {
      return { ok: false, reason: "full" };
    }
    room.members.set(member.clientId, { participant: member, connId, expiresAt });
    return { ok: true, count: room.members.size };
  }

  async touchMembers(roomId: string, clientIds: string[], expiresAt: number): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;
    for (const id of clientIds) {
      const member = room.members.get(id);
      if (member) member.expiresAt = expiresAt;
    }
  }

  async removeMember(
    roomId: string,
    clientId: string,
    connId: string,
    now: number,
  ): Promise<number> {
    const room = this.rooms.get(roomId);
    if (!room) return 0;
    if (room.members.get(clientId)?.connId === connId) room.members.delete(clientId);
    this.pruneMembers(room, now);
    return room.members.size;
  }

  async listMembers(roomId: string, now: number): Promise<Participant[]> {
    const room = this.rooms.get(roomId);
    if (!room) return [];
    this.pruneMembers(room, now);
    return [...room.members.values()].map((m) => m.participant);
  }

  async acquireLock(
    roomId: string,
    entityId: string,
    clientId: string,
    ttlMs: number,
  ): Promise<{ granted: boolean; holder: string | null }> {
    const room = this.rooms.get(roomId);
    if (!room) return { granted: false, holder: null };
    const now = this.now();
    const lock = room.locks.get(entityId);
    if (lock && lock.expiresAt > now && lock.holder !== clientId) {
      return { granted: false, holder: lock.holder };
    }
    room.locks.set(entityId, { holder: clientId, expiresAt: now + ttlMs });
    return { granted: true, holder: clientId };
  }

  async releaseLock(roomId: string, entityId: string, clientId: string): Promise<boolean> {
    const room = this.rooms.get(roomId);
    const lock = room?.locks.get(entityId);
    if (!room || !lock || lock.holder !== clientId) return false;
    room.locks.delete(entityId);
    return true;
  }

  async renewHostLease(roomId: string, expiresAt: number): Promise<void> {
    const room = this.rooms.get(roomId);
    if (room && room.meta.status !== "closed") room.hostLeaseUntil = expiresAt;
  }

  async expiredHostLeases(before: number): Promise<string[]> {
    const out: string[] = [];
    for (const [roomId, room] of this.rooms) {
      if (room.meta.status !== "closed" && room.hostLeaseUntil < before) out.push(roomId);
    }
    return out;
  }

  async markHostOffline(roomId: string): Promise<boolean> {
    const room = this.rooms.get(roomId);
    if (!room || !room.hostOnline) return false;
    room.hostOnline = false;
    return true;
  }

  async markHostOnline(roomId: string): Promise<void> {
    const room = this.rooms.get(roomId);
    if (room) room.hostOnline = true;
  }

  async isHostOnline(roomId: string): Promise<boolean> {
    return this.rooms.get(roomId)?.hostOnline ?? false;
  }

  async closeRoom(roomId: string, reason: SessionCloseReason): Promise<boolean> {
    const room = this.rooms.get(roomId);
    if (!room || room.meta.status === "closed") return false;
    room.meta.status = "closed";
    this.emit(room, { kind: "closed", reason });
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (this.rooms.get(roomId) === room) this.rooms.delete(roomId);
    }, CLOSED_ROOM_TTL_MS);
    timer.unref?.();
    this.timers.add(timer);
    return true;
  }

  async publishPresence(roomId: string, event: PresenceEvent): Promise<void> {
    const room = this.rooms.get(roomId);
    if (!room) return;
    for (const listener of [...room.presenceListeners]) listener(event);
  }

  async subscribePresence(
    roomId: string,
    listener: (event: PresenceEvent) => void,
  ): Promise<Unsubscribe> {
    const room = this.rooms.get(roomId);
    if (!room) return () => {};
    room.presenceListeners.add(listener);
    return () => {
      room.presenceListeners.delete(listener);
    };
  }

  async close(): Promise<void> {
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    this.rooms.clear();
  }

  private emit(room: MemoryRoom, event: RoomEvent): void {
    for (const listener of [...room.listeners]) listener(event);
  }

  private pruneMembers(room: MemoryRoom, now: number): void {
    for (const [id, member] of room.members) if (member.expiresAt <= now) room.members.delete(id);
  }
}
