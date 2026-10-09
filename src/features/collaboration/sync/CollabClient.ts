import {
  COLLAB_PROTOCOL_VERSION,
  LIMITS,
  chunkString,
  isDiagramState,
  isRecord,
  type ClientMessage,
  type CollabUser,
  type CursorEntry,
  type DiagramPatch,
  type DiagramState,
  type Entry,
  type ErrorCode,
  type Participant,
  type ServerMessage,
  type SessionCloseReason,
} from "@collab-protocol";

/**
 * One participant's connection to a room, as an explicit state machine with no React in it.
 *
 *   idle → connecting → seeding (host creating) | joining → ready ⇄ reconnecting → closed
 *
 * "ready" is entered by exactly one path — after the relay hands over the room state, either as a
 * catch-up (possibly empty) or a full snapshot — so a client can never sit connected but not ready.
 */

export type ClientPhase =
  "idle" | "connecting" | "seeding" | "joining" | "ready" | "reconnecting" | "closed";

/** Why a client stopped for good. */
export type ClosedReason =
  | SessionCloseReason
  | "left"
  | "room_unknown"
  | "room_full"
  | "protocol_mismatch"
  | "too_large"
  | "invalid_seed"
  | "unauthorized"
  | "unreachable";

export interface SocketLike {
  readonly readyState: number;
  send(data: string): void;
  close(code?: number, reason?: string): void;
  onopen: ((event: unknown) => void) | null;
  onmessage: ((event: { data: unknown }) => void) | null;
  onclose: ((event: unknown) => void) | null;
  onerror: ((event: unknown) => void) | null;
}

export interface CollabClientCallbacks {
  onPhase?: (phase: ClientPhase) => void;
  /** Full room state at `version`; the caller replaces its confirmed state with it. */
  onSnapshot: (version: number, state: DiagramState) => void;
  /** Entries after the version the caller declared; may be empty. */
  onCatchup: (version: number, entries: Entry[]) => void;
  onEntry: (entry: Entry) => void;
  onAck: (opId: string, applied: boolean) => void;
  onJoined?: (info: {
    clientId: string;
    role: "host" | "guest";
    participants: Participant[];
    maxParticipants: number;
    hostOnline: boolean;
  }) => void;
  onHostToken?: (token: string) => void;
  onPeerJoined?: (participant: Participant, count: number) => void;
  onPeerLeft?: (clientId: string, count: number) => void;
  onHostStatus?: (online: boolean) => void;
  onCursors?: (entries: CursorEntry[]) => void;
  onLock?: (entityId: string, holder: string | null, ttlMs: number) => void;
  onLockResult?: (entityId: string, granted: boolean, holder: string | null) => void;
  onClosed?: (reason: ClosedReason, detail?: { limit?: number; size?: number }) => void;
  onError?: (code: ErrorCode, message: string) => void;
}

export interface CollabClientOptions {
  url: string;
  roomId: string;
  user: CollabUser;
  role: "host" | "guest";
  /** Host only: the credential, when resuming or reseeding an existing room. */
  hostToken?: string | null;
  /** Host only, starting a new room: the diagram to seed it with. */
  getSeed?: () => DiagramState;
  /** The version the caller can vouch its state equals, or null to receive the full state. */
  getResumeVersion: () => number | null;
  createSocket?: (url: string) => SocketLike;
  /** Delays between reconnect attempts; the last one repeats. */
  reconnectDelaysMs?: number[];
  /** Give up after this long without getting back in. */
  reconnectWindowMs?: number;
  heartbeatMs?: number;
  notReadyRetryMs?: number;
  callbacks: CollabClientCallbacks;
}

const OPEN = 1;

export class CollabClient {
  private socket: SocketLike | null = null;
  private phase: ClientPhase = "idle";
  private hostToken: string | null;
  private seeded: boolean;
  private snapshotChunks: string[] = [];
  private attempt = 0;
  private disconnectedAt: number | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private lastMessageAt = 0;
  private opCounter = 0;
  /** Set once the room state has been received: a later `room_unknown` is a loss, not a bad link. */
  private everReady = false;
  /** Incarnation of the room the current state belongs to; a resume names it. */
  private epoch: string | null = null;
  /** When a room that existed started answering `room_unknown`. */
  private lostSince: number | null = null;
  private readonly opts: Required<
    Omit<CollabClientOptions, "hostToken" | "getSeed" | "createSocket" | "callbacks">
  >;
  private readonly cb: CollabClientCallbacks;
  private readonly createSocket: (url: string) => SocketLike;
  private readonly getSeed: (() => DiagramState) | undefined;

  constructor(options: CollabClientOptions) {
    this.cb = options.callbacks;
    this.hostToken = options.hostToken ?? null;
    // A host with a credential is rejoining a room that already exists.
    this.seeded = options.role === "guest" || this.hostToken !== null;
    this.getSeed = options.getSeed;
    this.createSocket =
      options.createSocket ?? ((url) => new WebSocket(url) as unknown as SocketLike);
    this.opts = {
      url: options.url,
      roomId: options.roomId,
      user: options.user,
      role: options.role,
      getResumeVersion: options.getResumeVersion,
      reconnectDelaysMs: options.reconnectDelaysMs ?? [250, 500, 1000, 2000, 3000],
      reconnectWindowMs: options.reconnectWindowMs ?? 120_000,
      heartbeatMs: options.heartbeatMs ?? 15_000,
      notReadyRetryMs: options.notReadyRetryMs ?? 1_000,
    };
  }

  get currentPhase(): ClientPhase {
    return this.phase;
  }

  get credential(): string | null {
    return this.hostToken;
  }

  start(): void {
    if (this.phase !== "idle") return;
    this.open();
  }

  /** Host: end the session for everyone. Guest: just leave. */
  leave(): void {
    if (this.phase === "closed") return;
    if (this.opts.role === "host" && this.phase === "ready") this.send({ type: "close" });
    this.finish("left");
  }

  /** Disconnect without ending the session (the host's grace period keeps the room). */
  leaveSilently(): void {
    this.finish("left");
  }

  /** Send a local change. Returns its op id, or null when not connected. */
  sendPatch(patch: DiagramPatch, baseVersion: number): string | null {
    if (this.phase !== "ready") return null;
    const opId = `${this.opts.user.id}:${Date.now().toString(36)}:${++this.opCounter}`;
    this.send({ type: "patch", opId, baseVersion, patch });
    return opId;
  }

  sendCursor(cursor: { x: number; y: number } | null, activeElementId: string | null): void {
    if (this.phase === "ready") this.send({ type: "cursor", cursor, activeElementId });
  }

  sendLock(action: "acquire" | "renew" | "release", entityId: string): void {
    if (this.phase === "ready") this.send({ type: "lock", action, entityId });
  }

  // ── Connection ──────────────────────────────────────────────────────────

  private setPhase(phase: ClientPhase): void {
    if (this.phase === phase) return;
    this.phase = phase;
    this.cb.onPhase?.(phase);
  }

  private open(): void {
    this.setPhase(this.disconnectedAt === null ? "connecting" : "reconnecting");
    let socket: SocketLike;
    try {
      socket = this.createSocket(this.opts.url);
    } catch {
      this.scheduleReconnect();
      return;
    }
    this.socket = socket;
    socket.onopen = () => {
      if (this.socket !== socket) return;
      this.lastMessageAt = Date.now();
      this.startHeartbeat();
      this.handshake();
    };
    socket.onmessage = (event) => {
      if (this.socket !== socket) return;
      this.lastMessageAt = Date.now();
      if (typeof event.data !== "string") return;
      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data);
      } catch {
        return;
      }
      if (isRecord(parsed) && typeof parsed.type === "string") {
        this.handle(parsed as ServerMessage);
      }
    };
    socket.onclose = () => {
      if (this.socket !== socket) return;
      this.socket = null;
      this.stopHeartbeat();
      if (this.phase === "closed") return;
      this.disconnectedAt ??= Date.now();
      this.scheduleReconnect();
    };
    socket.onerror = () => {
      // onclose follows and drives the reconnect.
    };
  }

  private handshake(): void {
    if (!this.seeded && this.opts.role === "host") {
      this.beginSeed();
      return;
    }
    const resumeFrom = this.opts.getResumeVersion();
    this.setPhase("joining");
    this.send({
      type: "join",
      protocol: COLLAB_PROTOCOL_VERSION,
      roomId: this.opts.roomId,
      user: this.opts.user,
      ...(this.opts.role === "host" && this.hostToken ? { hostToken: this.hostToken } : {}),
      ...(resumeFrom !== null && this.epoch ? { resumeFrom, resumeEpoch: this.epoch } : {}),
    });
  }

  private seedText: string[] | null = null;

  private beginSeed(): void {
    if (!this.getSeed) {
      this.finish("room_unknown");
      return;
    }
    const text = JSON.stringify(this.getSeed());
    if (text.length > LIMITS.maxSeedChars) {
      this.finish("too_large", { size: text.length, limit: LIMITS.maxSeedChars });
      return;
    }
    this.seedText = chunkString(text);
    this.setPhase("seeding");
    this.send({
      type: "create",
      protocol: COLLAB_PROTOCOL_VERSION,
      roomId: this.opts.roomId,
      user: this.opts.user,
      seedChars: text.length,
      seedChunks: this.seedText.length,
      ...(this.hostToken ? { hostToken: this.hostToken } : {}),
    });
  }

  private scheduleReconnect(): void {
    if (this.phase === "closed") return;
    const since = this.disconnectedAt ?? Date.now();
    if (Date.now() - since > this.opts.reconnectWindowMs) {
      this.finish("unreachable");
      return;
    }
    this.setPhase("reconnecting");
    const delays = this.opts.reconnectDelaysMs;
    const base = delays[Math.min(this.attempt, delays.length - 1)];
    this.attempt += 1;
    // Jitter, so a relay that drops 50 sockets is not hit by 50 reconnects in the same instant.
    this.later(base * (0.75 + Math.random() * 0.5), () => this.open());
  }

  private later(ms: number, fn: () => void): void {
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      fn();
    }, ms);
    this.timers.add(timer);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeat = setInterval(() => {
      if (Date.now() - this.lastMessageAt > this.opts.heartbeatMs * 2.5) {
        // Silent for too long: treat as dropped.
        this.socket?.close(4000, "heartbeat_timeout");
        return;
      }
      this.send({ type: "ping" });
    }, this.opts.heartbeatMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeat) clearInterval(this.heartbeat);
    this.heartbeat = null;
  }

  private finish(reason: ClosedReason, detail?: { limit?: number; size?: number }): void {
    if (this.phase === "closed") return;
    this.setPhase("closed");
    this.stopHeartbeat();
    for (const timer of this.timers) clearTimeout(timer);
    this.timers.clear();
    const socket = this.socket;
    this.socket = null;
    if (socket && socket.readyState === OPEN) socket.close(1000, reason);
    this.cb.onClosed?.(reason, detail);
  }

  private send(message: ClientMessage): void {
    const socket = this.socket;
    if (!socket || socket.readyState !== OPEN) return;
    socket.send(JSON.stringify(message));
  }

  private becameReady(): void {
    this.everReady = true;
    this.lostSince = null;
    this.attempt = 0;
    this.disconnectedAt = null;
    this.setPhase("ready");
  }

  // ── Inbound ─────────────────────────────────────────────────────────────

  private handle(message: ServerMessage): void {
    switch (message.type) {
      case "created": {
        this.hostToken = message.hostToken;
        this.cb.onHostToken?.(message.hostToken);
        const chunks = this.seedText ?? [];
        chunks.forEach((data, index) => this.send({ type: "seed:chunk", index, data }));
        this.send({ type: "seed:commit" });
        return;
      }
      case "joined": {
        if (message.role === "host") this.seeded = true;
        this.epoch = message.epoch;
        this.seedText = null;
        this.snapshotChunks = [];
        this.cb.onJoined?.({
          clientId: message.clientId,
          role: message.role,
          participants: message.participants,
          maxParticipants: message.maxParticipants,
          hostOnline: message.hostOnline,
        });
        if (message.catchup) {
          this.cb.onCatchup(message.version, message.catchup);
          this.becameReady();
        }
        return;
      }
      case "snapshot:chunk":
        this.snapshotChunks[message.index] = message.data;
        return;
      case "snapshot:end": {
        let state: unknown;
        try {
          state = JSON.parse(this.snapshotChunks.join(""));
        } catch {
          state = null;
        }
        this.snapshotChunks = [];
        if (!isDiagramState(state)) {
          // A torn transfer: drop the socket and get it again.
          this.socket?.close(4001, "bad_snapshot");
          return;
        }
        this.cb.onSnapshot(message.version, state);
        this.becameReady();
        return;
      }
      case "entry":
        this.cb.onEntry({
          version: message.version,
          opId: message.opId,
          sender: message.sender,
          patch: message.patch,
        });
        return;
      case "ack":
        this.cb.onAck(message.opId, message.applied);
        return;
      case "peer:joined":
        this.cb.onPeerJoined?.(message.participant, message.participantCount);
        return;
      case "peer:left":
        this.cb.onPeerLeft?.(message.clientId, message.participantCount);
        return;
      case "host:status":
        this.cb.onHostStatus?.(message.online);
        return;
      case "cursors":
        this.cb.onCursors?.(message.entries);
        return;
      case "lock":
        this.cb.onLock?.(message.entityId, message.holder, message.ttlMs);
        return;
      case "lock:result":
        this.cb.onLockResult?.(message.entityId, message.granted, message.holder);
        return;
      case "session:closed":
        this.finish(message.reason);
        return;
      case "error":
        this.handleError(message.code, message.message, message);
        return;
      case "ping":
        this.send({ type: "pong" });
        return;
      case "pong":
        return;
    }
  }

  private handleError(
    code: ErrorCode,
    text: string,
    detail: { limit?: number; size?: number },
  ): void {
    this.cb.onError?.(code, text);
    switch (code) {
      case "room_unknown":
        // Only the host may bring a room back, and only with its credential and its own copy.
        if (this.opts.role === "host" && this.hostToken && this.getSeed) {
          this.seeded = false;
          this.beginSeed();
          return;
        }
        // A guest whose room vanished (storage restarted) waits for the host to bring it back,
        // as long as the host could still be coming; a link to a room that never was ends here.
        if (this.everReady) {
          this.lostSince ??= Date.now();
          if (Date.now() - this.lostSince < LIMITS.hostGraceMs) {
            this.later(this.opts.notReadyRetryMs, () => this.handshake());
            return;
          }
        }
        this.finish("room_unknown");
        return;
      case "room_exists":
        // Someone recreated the room first; join it instead.
        if (this.opts.role === "host" && this.hostToken) {
          this.seeded = true;
          this.handshake();
        } else {
          this.finish("unauthorized");
        }
        return;
      case "not_ready":
        this.later(this.opts.notReadyRetryMs, () => this.handshake());
        return;
      case "session_closed":
        this.finish("host_closed");
        return;
      case "room_full":
        this.finish("room_full", detail);
        return;
      case "protocol_mismatch":
        this.finish("protocol_mismatch");
        return;
      case "unauthorized":
        if (this.phase === "joining" || this.phase === "seeding") this.finish("unauthorized");
        return;
      case "too_large":
        if (this.phase === "seeding") this.finish("too_large", detail);
        return;
      case "invalid_seed":
        this.finish("invalid_seed");
        return;
      case "unavailable":
        if (this.phase === "joining" || this.phase === "seeding") {
          this.later(this.opts.notReadyRetryMs, () => this.socket?.close(4002, "retry"));
        }
        return;
      default:
        return;
    }
  }
}
