import { createHash, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import {
  chunkString,
  COLLAB_PROTOCOL_VERSION,
  LIMITS,
  parseClientMessage,
  type ClientMessage,
  type CollabUser,
  type CursorEntry,
  type ErrorCode,
  type Participant,
  type ServerMessage,
} from "./protocol.js";
import { TokenBucket } from "./rateLimit.js";
import type { PresenceEvent, RoomEvent, RoomStore, Unsubscribe } from "./store/types.js";

/**
 * Session handlers for protocol v3. A relay holds sockets and nothing else that matters: every
 * piece of session state lives in the `RoomStore`, so any number of relays can serve one room
 * and losing one loses only its sockets, which reconnect elsewhere.
 */

/** The one thing a relay needs from a socket. */
export interface Conn {
  send(text: string): void;
  close(code: number, reason: string): void;
  /** Bytes queued and not yet written. */
  bufferedAmount(): number;
}

export interface RelayOptions {
  maxParticipants?: number;
  hostGraceMs?: number;
  /** How long a host lease lasts without renewal; the grace period counts from the drop. */
  hostLeaseMs?: number;
  hostLeaseRenewMs?: number;
  memberTtlMs?: number;
  memberRenewMs?: number;
  reaperIntervalMs?: number;
  /** How often a relay confirms its rooms still exist in the store (a storage restart loses them). */
  roomCheckMs?: number;
  cursorFlushMs?: number;
  patchRate?: { rate: number; burst: number };
  cursorRate?: { rate: number; burst: number };
  lockRate?: { rate: number; burst: number };
  lossyQueueBytes?: number;
  maxQueueBytes?: number;
  now?: () => number;
  log?: (line: string) => void;
}

type Phase = "new" | "seeding" | "joining" | "joined" | "closed";

interface ConnState {
  id: string;
  conn: Conn;
  phase: Phase;
  roomId: string | null;
  clientId: string | null;
  role: "host" | "guest" | null;
  user: CollabUser | null;
  /** Last version this socket was given; events at or below it are not sent again. */
  delivered: number;
  /** Events that arrived while the join was still being answered. */
  buffer: RoomEvent[] | null;
  seedChunks: number;
  seedReceived: Set<number>;
  locks: Set<string>;
  queue: Promise<void>;
  patchBucket: TokenBucket;
  cursorBucket: TokenBucket;
  lockBucket: TokenBucket;
}

interface LocalRoom {
  /** The room incarnation this subscription follows. */
  epoch: string;
  conns: Set<ConnState>;
  ready: Promise<void>;
  unsubscribe: Unsubscribe | null;
  unsubscribePresence: Unsubscribe | null;
  cursors: Map<string, CursorEntry>;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function tokenMatches(token: string, expectedHash: string): boolean {
  const actual = Buffer.from(hashToken(token), "hex");
  const expected = Buffer.from(expectedHash, "hex");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

export class CollabRelay {
  private readonly conns = new Set<ConnState>();
  private readonly rooms = new Map<string, LocalRoom>();
  private readonly intervals: Array<ReturnType<typeof setInterval>> = [];
  private readonly opt: Required<Omit<RelayOptions, "log" | "now">>;
  private readonly now: () => number;
  private readonly log: (line: string) => void;
  private stopped = false;

  constructor(
    private readonly store: RoomStore,
    options: RelayOptions = {},
  ) {
    this.now = options.now ?? Date.now;
    this.log = options.log ?? ((line) => console.log(line));
    this.opt = {
      maxParticipants: options.maxParticipants ?? LIMITS.maxParticipants,
      hostGraceMs: options.hostGraceMs ?? LIMITS.hostGraceMs,
      hostLeaseMs: options.hostLeaseMs ?? 5_000,
      hostLeaseRenewMs: options.hostLeaseRenewMs ?? 2_000,
      memberTtlMs: options.memberTtlMs ?? 30_000,
      memberRenewMs: options.memberRenewMs ?? 10_000,
      reaperIntervalMs: options.reaperIntervalMs ?? 1_000,
      roomCheckMs: options.roomCheckMs ?? 2_000,
      cursorFlushMs: options.cursorFlushMs ?? 50,
      patchRate: options.patchRate ?? { rate: 30, burst: 60 },
      cursorRate: options.cursorRate ?? { rate: 20, burst: 20 },
      lockRate: options.lockRate ?? { rate: 10, burst: 20 },
      lossyQueueBytes: options.lossyQueueBytes ?? 1024 * 1024,
      maxQueueBytes: options.maxQueueBytes ?? 8 * 1024 * 1024,
    };

    this.every(this.opt.hostLeaseRenewMs, () => this.renewHostLeases());
    this.every(this.opt.memberRenewMs, () => this.renewMembers());
    this.every(this.opt.reaperIntervalMs, () => this.reap());
    this.every(this.opt.roomCheckMs, () => this.checkRooms());
    this.every(this.opt.cursorFlushMs, () => this.flushCursors());
  }

  /** Register a socket. The transport calls the returned handlers. */
  connect(conn: Conn): { onMessage: (raw: string) => void; onClose: () => void } {
    const state: ConnState = {
      id: randomUUID(),
      conn,
      phase: "new",
      roomId: null,
      clientId: null,
      role: null,
      user: null,
      delivered: 0,
      buffer: null,
      seedChunks: 0,
      seedReceived: new Set(),
      locks: new Set(),
      queue: Promise.resolve(),
      patchBucket: new TokenBucket(this.opt.patchRate.rate, this.opt.patchRate.burst, this.now),
      cursorBucket: new TokenBucket(this.opt.cursorRate.rate, this.opt.cursorRate.burst, this.now),
      lockBucket: new TokenBucket(this.opt.lockRate.rate, this.opt.lockRate.burst, this.now),
    };
    this.conns.add(state);

    return {
      onMessage: (raw) => {
        if (raw.length > LIMITS.maxFrameChars) {
          this.sendError(state, "too_large", "Frame too large", {
            limit: LIMITS.maxFrameChars,
            size: raw.length,
          });
          return;
        }
        const message = parseClientMessage(raw);
        if (!message) {
          this.sendError(state, "invalid_message", "Malformed or unknown message");
          return;
        }
        // One message at a time per socket: seed chunks and patches keep their order.
        state.queue = state.queue
          .then(() => this.handle(state, message))
          .catch((err: unknown) => {
            this.log(
              `[collab] handler failed: ${err instanceof Error ? err.message : String(err)}`,
            );
            this.sendError(state, "unavailable", "Temporary failure, retry");
          });
      },
      onClose: () => {
        state.queue = state.queue.then(() => this.disconnect(state));
      },
    };
  }

  async stop(): Promise<void> {
    this.stopped = true;
    for (const interval of this.intervals) clearInterval(interval);
    for (const state of [...this.conns]) {
      state.conn.close(1001, "server_shutdown");
      await this.disconnect(state);
    }
  }

  // ── Dispatch ────────────────────────────────────────────────────────────

  private async handle(state: ConnState, message: ClientMessage): Promise<void> {
    if (state.phase === "closed") return;
    switch (message.type) {
      case "ping":
        this.send(state, { type: "pong" });
        return;
      case "pong":
        return;
      case "create":
        return this.handleCreate(state, message);
      case "seed:chunk":
        return this.handleSeedChunk(state, message.index, message.data);
      case "seed:commit":
        return this.handleSeedCommit(state);
      case "join":
        return this.handleJoin(state, message);
      case "patch":
        return this.handlePatch(state, message);
      case "lock":
        return this.handleLock(state, message.action, message.entityId);
      case "cursor":
        return this.handleCursor(state, message.cursor, message.activeElementId);
      case "close":
        return this.handleClose(state);
    }
  }

  // ── Create and seed ─────────────────────────────────────────────────────

  private async handleCreate(
    state: ConnState,
    message: Extract<ClientMessage, { type: "create" }>,
  ): Promise<void> {
    if (state.phase !== "new") return this.sendError(state, "already_joined", "Already in a room");
    if (message.protocol !== COLLAB_PROTOCOL_VERSION) return this.refuseProtocol(state);
    if (message.seedChars > LIMITS.maxSeedChars) {
      return this.sendError(state, "too_large", "Diagram too large for a live session", {
        limit: LIMITS.maxSeedChars,
        size: message.seedChars,
      });
    }
    const expectedChunks = Math.max(1, Math.ceil(message.seedChars / LIMITS.chunkChars));
    if (message.seedChunks !== expectedChunks) {
      return this.sendError(state, "invalid_seed", "Chunk count does not match the seed size");
    }

    const hostToken = message.hostToken ?? randomBytes(32).toString("base64url");
    const created = await this.store.createRoom({
      roomId: message.roomId,
      hostTokenHash: hashToken(hostToken),
      hostUser: message.user,
      seedChunks: message.seedChunks,
      now: this.now(),
    });
    if (created === "exists") return this.sendError(state, "room_exists", "Room already exists");

    state.phase = "seeding";
    state.roomId = message.roomId;
    state.clientId = message.user.id;
    state.user = message.user;
    state.role = "host";
    state.seedChunks = message.seedChunks;
    await this.store.renewHostLease(message.roomId, this.now() + this.opt.hostLeaseMs);
    this.send(state, {
      type: "created",
      roomId: message.roomId,
      clientId: message.user.id,
      hostToken,
    });
  }

  private async handleSeedChunk(state: ConnState, index: number, data: string): Promise<void> {
    if (state.phase !== "seeding" || !state.roomId) {
      return this.sendError(state, "not_joined", "No seed in progress");
    }
    if (index < 0 || index >= state.seedChunks || data.length > LIMITS.chunkChars) {
      return this.sendError(state, "invalid_seed", "Chunk out of range");
    }
    await this.store.appendSeedChunk(state.roomId, index, data);
    state.seedReceived.add(index);
  }

  private async handleSeedCommit(state: ConnState): Promise<void> {
    if (state.phase !== "seeding" || !state.roomId || !state.user) {
      return this.sendError(state, "not_joined", "No seed in progress");
    }
    const roomId = state.roomId;
    const result = await this.store.commitSeed(roomId);
    if (!result.ok) {
      await this.store.discardRoom(roomId);
      state.phase = "new";
      state.roomId = null;
      return this.sendError(state, "invalid_seed", "The seed could not be read");
    }

    const participant: Participant = { clientId: state.user.id, user: state.user, role: "host" };
    await this.store.addMember(
      roomId,
      participant,
      state.id,
      this.now() + this.opt.memberTtlMs,
      this.opt.maxParticipants,
      this.now(),
    );
    state.phase = "joining";
    state.buffer = [];
    const meta = await this.store.getMeta(roomId);
    const epoch = meta?.epoch ?? "";
    await this.attach(state, roomId, epoch);
    await this.store.markHostOnline(roomId);
    this.send(state, {
      type: "joined",
      clientId: participant.clientId,
      role: "host",
      version: 0,
      participants: [participant],
      maxParticipants: this.opt.maxParticipants,
      hostOnline: true,
      epoch,
      catchup: [],
    });
    this.finishJoin(state, 0);
    this.log(`[collab] room opened: ${roomId}`);
  }

  // ── Join ────────────────────────────────────────────────────────────────

  private async handleJoin(
    state: ConnState,
    message: Extract<ClientMessage, { type: "join" }>,
  ): Promise<void> {
    if (state.phase !== "new") return this.sendError(state, "already_joined", "Already in a room");
    if (message.protocol !== COLLAB_PROTOCOL_VERSION) return this.refuseProtocol(state);

    const meta = await this.store.getMeta(message.roomId);
    if (!meta) return this.sendError(state, "room_unknown", "Room unknown");
    if (meta.status === "seeding") return this.sendError(state, "not_ready", "Session not ready");
    if (meta.status === "closed") return this.sendError(state, "session_closed", "Session ended");

    let role: "host" | "guest" = "guest";
    if (message.hostToken !== undefined) {
      if (!tokenMatches(message.hostToken, meta.hostTokenHash)) {
        return this.sendError(state, "unauthorized", "Invalid host credential");
      }
      role = "host";
    }

    const roomId = message.roomId;
    const participant: Participant = { clientId: message.user.id, user: message.user, role };
    const added = await this.store.addMember(
      roomId,
      participant,
      state.id,
      this.now() + this.opt.memberTtlMs,
      this.opt.maxParticipants,
      this.now(),
    );
    if (!added.ok) {
      this.sendError(state, "room_full", "Room is full", { limit: this.opt.maxParticipants });
      state.conn.close(1008, "room_full");
      state.phase = "closed";
      return;
    }

    state.phase = "joining";
    state.roomId = roomId;
    state.clientId = participant.clientId;
    state.user = message.user;
    state.role = role;
    state.buffer = [];
    await this.attach(state, roomId, meta.epoch);

    if (role === "host") {
      await this.store.renewHostLease(roomId, this.now() + this.opt.hostLeaseMs);
      const wasOffline = !(await this.store.isHostOnline(roomId));
      await this.store.markHostOnline(roomId);
      if (wasOffline)
        await this.store.publishPresence(roomId, { kind: "host:status", online: true });
    }

    const participants = await this.store.listMembers(roomId, this.now());
    const hostOnline = await this.store.isHostOnline(roomId);
    const base = {
      type: "joined" as const,
      clientId: participant.clientId,
      role,
      participants,
      maxParticipants: this.opt.maxParticipants,
      hostOnline,
      epoch: meta.epoch,
    };

    // A resume is only meaningful within the incarnation it was taken from.
    const catchup =
      message.resumeFrom !== undefined && message.resumeEpoch === meta.epoch
        ? await this.store.readEntries(roomId, message.resumeFrom)
        : null;

    if (catchup && message.resumeFrom !== undefined) {
      const version = catchup.length > 0 ? catchup[catchup.length - 1].version : message.resumeFrom;
      this.send(state, { ...base, version, catchup });
      this.finishJoin(state, version);
    } else {
      const snapshot = await this.store.readSnapshot(roomId);
      if (!snapshot) {
        await this.detach(state);
        return this.sendError(state, "session_closed", "Session ended");
      }
      this.send(state, { ...base, version: snapshot.version });
      const chunks = chunkString(JSON.stringify(snapshot.state));
      chunks.forEach((data, index) => {
        this.send(state, { type: "snapshot:chunk", index, total: chunks.length, data });
      });
      this.send(state, { type: "snapshot:end", version: snapshot.version });
      this.finishJoin(state, snapshot.version);
    }

    await this.store.publishPresence(roomId, {
      kind: "peer:joined",
      participant,
      participantCount: participants.length,
    });
  }

  /** Flush what arrived during the join, then go live. */
  private finishJoin(state: ConnState, version: number): void {
    state.delivered = version;
    const buffered = state.buffer ?? [];
    state.buffer = null;
    state.phase = "joined";
    for (const event of buffered) this.deliver(state, event);
  }

  // ── Edits ───────────────────────────────────────────────────────────────

  private async handlePatch(
    state: ConnState,
    message: Extract<ClientMessage, { type: "patch" }>,
  ): Promise<void> {
    if (state.phase !== "joined" || !state.roomId || !state.clientId) {
      return this.sendError(state, "not_joined", "Join a room first");
    }
    if (!state.patchBucket.take()) {
      this.send(state, {
        type: "ack",
        opId: message.opId,
        applied: false,
        version: state.delivered,
      });
      return this.sendError(state, "rate_limited", "Too many edits");
    }
    const result = await this.store.applyPatch(state.roomId, {
      patch: message.patch,
      senderVersion: message.baseVersion,
      senderId: state.clientId,
      opId: message.opId,
    });
    if (result.status === "not_open") {
      this.send(state, {
        type: "ack",
        opId: message.opId,
        applied: false,
        version: state.delivered,
      });
      return;
    }
    this.send(state, {
      type: "ack",
      opId: message.opId,
      applied: result.status === "applied",
      version: result.version,
    });
  }

  private async handleLock(
    state: ConnState,
    action: "acquire" | "renew" | "release",
    entityId: string,
  ): Promise<void> {
    if (state.phase !== "joined" || !state.roomId || !state.clientId) {
      return this.sendError(state, "not_joined", "Join a room first");
    }
    if (!state.lockBucket.take()) return this.sendError(state, "rate_limited", "Too many locks");
    const roomId = state.roomId;
    const ttlMs = LIMITS.lockTtlMs;

    if (action === "release") {
      state.locks.delete(entityId);
      if (await this.store.releaseLock(roomId, entityId, state.clientId)) {
        await this.store.publishPresence(roomId, { kind: "lock", entityId, holder: null, ttlMs });
      }
      return;
    }

    const result = await this.store.acquireLock(roomId, entityId, state.clientId, ttlMs);
    if (result.granted) state.locks.add(entityId);
    if (action === "acquire" || !result.granted) {
      this.send(state, {
        type: "lock:result",
        entityId,
        granted: result.granted,
        holder: result.holder,
      });
    }
    if (result.granted) {
      await this.store.publishPresence(roomId, {
        kind: "lock",
        entityId,
        holder: state.clientId,
        ttlMs,
      });
    }
  }

  private handleCursor(
    state: ConnState,
    cursor: CursorEntry["cursor"],
    activeElementId: string | null,
  ): void {
    if (state.phase !== "joined" || !state.roomId || !state.clientId) return;
    if (!state.cursorBucket.take()) return;
    const room = this.rooms.get(state.roomId);
    room?.cursors.set(state.clientId, { clientId: state.clientId, cursor, activeElementId });
  }

  private async handleClose(state: ConnState): Promise<void> {
    if (state.phase !== "joined" || state.role !== "host" || !state.roomId) {
      return this.sendError(state, "unauthorized", "Only the host can end the session");
    }
    await this.store.closeRoom(state.roomId, "host_closed");
  }

  // ── Room attachment and fan-out ─────────────────────────────────────────

  private async attach(state: ConnState, roomId: string, epoch: string): Promise<void> {
    let room = this.rooms.get(roomId);
    if (room && room.epoch !== epoch) {
      // A stale subscription to an earlier incarnation: it must not serve this one.
      await this.dropLocalRoom(roomId, room);
      room = undefined;
    }
    if (!room) {
      const created: LocalRoom = {
        epoch,
        conns: new Set(),
        ready: Promise.resolve(),
        unsubscribe: null,
        unsubscribePresence: null,
        cursors: new Map(),
      };
      created.ready = (async () => {
        created.unsubscribe = await this.store.subscribe(roomId, (event) =>
          this.onRoomEvent(roomId, event),
        );
        created.unsubscribePresence = await this.store.subscribePresence(roomId, (event) =>
          this.onPresence(roomId, event),
        );
      })();
      this.rooms.set(roomId, created);
      room = created;
    }
    room.conns.add(state);
    await room.ready;
  }

  private async detach(state: ConnState): Promise<void> {
    if (!state.roomId) return;
    const room = this.rooms.get(state.roomId);
    if (!room) return;
    room.conns.delete(state);
    if (room.conns.size === 0) {
      this.rooms.delete(state.roomId);
      await room.ready;
      room.unsubscribe?.();
      room.unsubscribePresence?.();
    }
  }

  private onRoomEvent(roomId: string, event: RoomEvent): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    for (const state of room.conns) {
      if (state.phase === "joining") state.buffer?.push(event);
      else if (state.phase === "joined") this.deliver(state, event);
    }
  }

  private deliver(state: ConnState, event: RoomEvent): void {
    if (event.kind === "closed") {
      this.send(state, { type: "session:closed", reason: event.reason });
      state.phase = "closed";
      state.conn.close(1000, "session_closed");
      return;
    }
    if (event.entry.version <= state.delivered) return;
    state.delivered = event.entry.version;
    this.send(state, { type: "entry", ...event.entry });
  }

  private onPresence(roomId: string, event: PresenceEvent): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    let message: ServerMessage;
    let lossy = false;
    switch (event.kind) {
      case "cursors":
        message = { type: "cursors", entries: event.entries };
        lossy = true;
        break;
      case "peer:joined":
        message = {
          type: "peer:joined",
          participant: event.participant,
          participantCount: event.participantCount,
        };
        break;
      case "peer:left":
        message = {
          type: "peer:left",
          clientId: event.clientId,
          participantCount: event.participantCount,
        };
        break;
      case "host:status":
        message = { type: "host:status", online: event.online };
        break;
      case "lock":
        message = {
          type: "lock",
          entityId: event.entityId,
          holder: event.holder,
          ttlMs: event.ttlMs,
        };
        break;
    }
    const text = JSON.stringify(message);
    for (const state of room.conns) {
      if (state.phase !== "joined") continue;
      if (event.kind === "peer:joined" && event.participant.clientId === state.clientId) continue;
      this.sendText(state, text, lossy);
    }
  }

  // ── Disconnect ──────────────────────────────────────────────────────────

  private async disconnect(state: ConnState): Promise<void> {
    if (!this.conns.has(state)) return;
    this.conns.delete(state);
    const wasJoined = state.phase === "joined" || state.phase === "joining";
    state.phase = "closed";
    const roomId = state.roomId;
    if (!roomId || !state.clientId) return;

    const room = this.rooms.get(roomId);
    room?.cursors.delete(state.clientId);
    await this.detach(state);
    if (!wasJoined) return;

    // A reconnect may already have replaced this socket; only the last socket of a client
    // removes it from the room.
    const stillHere = [...this.conns].some(
      (other) => other.roomId === roomId && other.clientId === state.clientId,
    );
    if (stillHere) return;

    for (const entityId of state.locks) {
      if (await this.store.releaseLock(roomId, entityId, state.clientId)) {
        await this.store.publishPresence(roomId, {
          kind: "lock",
          entityId,
          holder: null,
          ttlMs: LIMITS.lockTtlMs,
        });
      }
    }
    const count = await this.store.removeMember(roomId, state.clientId, state.id, this.now());
    await this.store.publishPresence(roomId, {
      kind: "peer:left",
      clientId: state.clientId,
      participantCount: count,
    });
  }

  // ── Timers ──────────────────────────────────────────────────────────────

  private every(ms: number, task: () => Promise<void> | void): void {
    const interval = setInterval(() => {
      if (this.stopped) return;
      Promise.resolve(task()).catch((err: unknown) => {
        this.log(`[collab] timer failed: ${err instanceof Error ? err.message : String(err)}`);
      });
    }, ms);
    interval.unref?.();
    this.intervals.push(interval);
  }

  private async renewHostLeases(): Promise<void> {
    const until = this.now() + this.opt.hostLeaseMs;
    const hosted = new Set<string>();
    for (const state of this.conns) {
      if (state.role === "host" && state.roomId && state.phase !== "closed")
        hosted.add(state.roomId);
    }
    for (const roomId of hosted) await this.store.renewHostLease(roomId, until);
  }

  private async renewMembers(): Promise<void> {
    const until = this.now() + this.opt.memberTtlMs;
    const byRoom = new Map<string, string[]>();
    for (const state of this.conns) {
      if (state.phase !== "joined" || !state.roomId || !state.clientId) continue;
      const list = byRoom.get(state.roomId) ?? [];
      list.push(state.clientId);
      byRoom.set(state.roomId, list);
    }
    for (const [roomId, ids] of byRoom) await this.store.touchMembers(roomId, ids, until);
  }

  /** Any relay may run this; the store makes each transition happen once. */
  private async reap(): Promise<void> {
    const now = this.now();
    for (const roomId of await this.store.expiredHostLeases(now)) {
      if (await this.store.markHostOffline(roomId)) {
        await this.store.publishPresence(roomId, { kind: "host:status", online: false });
      }
    }
    const closeBefore = now - (this.opt.hostGraceMs - this.opt.hostLeaseMs);
    for (const roomId of await this.store.expiredHostLeases(closeBefore)) {
      const meta = await this.store.getMeta(roomId);
      if (meta?.status === "seeding") {
        await this.store.discardRoom(roomId);
        continue;
      }
      if (await this.store.closeRoom(roomId, "host_timeout")) {
        this.log(`[collab] room closed, host did not return: ${roomId}`);
      }
    }
  }

  /**
   * A room this relay serves vanished from the store (storage restarted without persistence), or
   * was recreated under the same id (a new epoch) while this relay still followed the old one.
   * Drop its sockets so every client reconnects and learns `room_unknown`: the host then reseeds
   * and the rest rejoin. The local subscription goes too — its stream position is meaningless
   * for the room that replaces it.
   */
  private async checkRooms(): Promise<void> {
    for (const [roomId, room] of [...this.rooms]) {
      const meta = await this.store.getMeta(roomId);
      if (meta && meta.epoch === room.epoch) continue;
      if (this.rooms.get(roomId) !== room) continue;
      await this.dropLocalRoom(roomId, room);
      this.log(`[collab] room lost from storage, clients told to reconnect: ${roomId}`);
    }
  }

  /** Forget a local subscription and send its sockets back through a fresh join. */
  private async dropLocalRoom(roomId: string, room: LocalRoom): Promise<void> {
    if (this.rooms.get(roomId) === room) this.rooms.delete(roomId);
    await room.ready;
    room.unsubscribe?.();
    room.unsubscribePresence?.();
    for (const state of [...room.conns]) {
      if (state.phase === "seeding") continue;
      state.conn.close(4004, "room_lost");
    }
  }

  private flushCursors(): void {
    for (const [roomId, room] of this.rooms) {
      if (room.cursors.size === 0) continue;
      const entries = [...room.cursors.values()];
      room.cursors.clear();
      void this.store.publishPresence(roomId, { kind: "cursors", entries });
    }
  }

  // ── Output ──────────────────────────────────────────────────────────────

  private refuseProtocol(state: ConnState): void {
    this.sendError(
      state,
      "protocol_mismatch",
      `This server speaks protocol ${COLLAB_PROTOCOL_VERSION}`,
    );
    state.phase = "closed";
    state.conn.close(1008, "protocol_mismatch");
  }

  private sendError(
    state: ConnState,
    code: ErrorCode,
    message: string,
    extra: { limit?: number; size?: number } = {},
  ): void {
    this.send(state, { type: "error", code, message, ...extra });
  }

  private send(state: ConnState, message: ServerMessage): void {
    this.sendText(state, JSON.stringify(message), false);
  }

  private sendText(state: ConnState, text: string, lossy: boolean): void {
    const queued = state.conn.bufferedAmount();
    if (lossy && queued > this.opt.lossyQueueBytes) return;
    if (queued > this.opt.maxQueueBytes) {
      // Too far behind to catch up live; it reconnects and resumes.
      state.conn.close(1013, "backpressure");
      return;
    }
    state.conn.send(text);
  }
}
