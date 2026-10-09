/**
 * A protocol-v3 participant that behaves like the browser client where it matters for
 * acceptance: it keeps the room state by applying entries in order, reconnects on its own
 * (resuming when it can vouch for its state, otherwise taking the snapshot), and — as host —
 * reseeds a room the relay reports as unknown. It records what the measurements need.
 */
import WebSocket from "ws";
import {
  applyEffectivePatch,
  chunkString,
  COLLAB_PROTOCOL_VERSION,
  type CollabUser,
  type DiagramPatch,
  type DiagramState,
  type ServerMessage,
} from "../src/collab/protocol.js";

export interface ParticipantOptions {
  url: string;
  roomId: string;
  user: CollabUser;
  role: "host" | "guest";
  /** Host only: the diagram to seed. */
  seed?: DiagramState;
  /** Called for every entry, with the local receive time. */
  onEntry?: (entry: Extract<ServerMessage, { type: "entry" }>, receivedAt: number) => void;
  reconnectDelayMs?: number;
}

export class Participant {
  state: DiagramState | null = null;
  version = 0;
  hostToken: string | null = null;
  epoch: string | null = null;
  ready = false;
  ended: string | null = null;
  /** Time the socket last dropped, and how long each outage lasted until ready again. */
  private downAt: number | null = null;
  readonly outagesMs: number[] = [];
  readonly errors: string[] = [];
  acked = 0;
  refused = 0;
  private ws: WebSocket | null = null;
  private pending = 0;
  private snapshot: string[] = [];
  private stopped = false;
  private seq = 0;
  private readyWaiters: Array<() => void> = [];

  constructor(readonly opts: ParticipantOptions) {}

  get id(): string {
    return this.opts.user.id;
  }

  start(): Promise<void> {
    this.open();
    return this.whenReady();
  }

  whenReady(): Promise<void> {
    if (this.ready) return Promise.resolve();
    return new Promise((resolve) => this.readyWaiters.push(resolve));
  }

  /** Cut the socket as a network failure would. */
  drop(): void {
    this.ws?.terminate();
  }

  /** Stop for good, without ending the session (a host that vanished). */
  vanish(): void {
    this.stopped = true;
    this.ws?.terminate();
  }

  close(): void {
    this.stopped = true;
    this.ws?.close();
  }

  endSession(): void {
    this.send({ type: "close" });
  }

  /** Send a change composed against the state this participant holds. */
  patch(patch: DiagramPatch): boolean {
    if (!this.ready) return false;
    const opId = `${this.id}|${Date.now()}|${++this.seq}`;
    this.pending += 1;
    this.send({ type: "patch", opId, baseVersion: this.version, patch });
    return true;
  }

  private send(message: Record<string, unknown>): void {
    if (this.ws?.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  private open(): void {
    const ws = new WebSocket(this.opts.url, { perMessageDeflate: false });
    this.ws = ws;
    ws.on("open", () => this.handshake());
    ws.on("message", (data) => this.onMessage(JSON.parse(data.toString()) as ServerMessage));
    ws.on("error", () => {});
    ws.on("close", () => {
      if (this.ws !== ws) return;
      this.ready = false;
      if (this.stopped || this.ended) return;
      this.downAt ??= Date.now();
      setTimeout(
        () => this.open(),
        (this.opts.reconnectDelayMs ?? 250) * (0.75 + Math.random() * 0.5),
      );
    });
  }

  private handshake(): void {
    if (this.opts.role === "host" && !this.hostToken) {
      this.create();
      return;
    }
    // Resume only when nothing of ours is unconfirmed — the client's rule.
    const resume =
      this.state && this.pending === 0 && this.epoch
        ? { resumeFrom: this.version, resumeEpoch: this.epoch }
        : {};
    this.send({
      type: "join",
      protocol: COLLAB_PROTOCOL_VERSION,
      roomId: this.opts.roomId,
      user: this.opts.user,
      ...(this.opts.role === "host" && this.hostToken ? { hostToken: this.hostToken } : {}),
      ...resume,
    });
  }

  private seedChunks: string[] = [];

  private create(): void {
    const seed = this.state ?? this.opts.seed;
    if (!seed) throw new Error("host without a seed");
    const text = JSON.stringify(seed);
    this.seedChunks = chunkString(text);
    this.state = seed;
    this.version = 0;
    this.send({
      type: "create",
      protocol: COLLAB_PROTOCOL_VERSION,
      roomId: this.opts.roomId,
      user: this.opts.user,
      seedChars: text.length,
      seedChunks: this.seedChunks.length,
      ...(this.hostToken ? { hostToken: this.hostToken } : {}),
    });
  }

  private becameReady(): void {
    this.ready = true;
    if (this.downAt !== null) {
      this.outagesMs.push(Date.now() - this.downAt);
      this.downAt = null;
    }
    for (const resolve of this.readyWaiters.splice(0)) resolve();
  }

  private onMessage(message: ServerMessage): void {
    const at = performance.now();
    switch (message.type) {
      case "created":
        this.hostToken = message.hostToken;
        this.seedChunks.forEach((data, index) => this.send({ type: "seed:chunk", index, data }));
        this.send({ type: "seed:commit" });
        return;
      case "joined":
        this.pending = 0;
        this.epoch = message.epoch;
        if (message.catchup) {
          for (const entry of message.catchup) this.apply(entry.version, entry.patch);
          this.version = message.version;
          this.becameReady();
        }
        this.snapshot = [];
        return;
      case "snapshot:chunk":
        this.snapshot[message.index] = message.data;
        return;
      case "snapshot:end":
        this.state = JSON.parse(this.snapshot.join("")) as DiagramState;
        this.snapshot = [];
        this.version = message.version;
        this.becameReady();
        return;
      case "entry":
        this.apply(message.version, message.patch);
        if (message.sender === this.id) this.pending = Math.max(0, this.pending - 1);
        this.opts.onEntry?.(message, at);
        return;
      case "ack":
        if (message.applied) this.acked += 1;
        else {
          this.refused += 1;
          this.pending = Math.max(0, this.pending - 1);
        }
        return;
      case "session:closed":
        this.ended = message.reason;
        return;
      case "error":
        if (message.code === "room_unknown" && this.opts.role === "host" && this.hostToken) {
          this.create();
          return;
        }
        if (message.code === "not_ready" || message.code === "room_unknown") {
          setTimeout(() => this.handshake(), 300);
          return;
        }
        if (message.code === "session_closed") {
          this.ended = "session_closed";
          return;
        }
        this.errors.push(message.code);
        return;
      case "ping":
        this.send({ type: "pong" });
        return;
      default:
        return;
    }
  }

  private apply(version: number, patch: DiagramPatch): void {
    if (!this.state || version <= this.version) return;
    this.state = applyEffectivePatch(this.state, patch);
    this.version = version;
  }
}

/** Key-order-independent JSON of a state, for byte comparison across participants. */
export function canonical(value: unknown): string {
  return JSON.stringify(value, (_k, v: unknown) =>
    v && typeof v === "object" && !Array.isArray(v)
      ? Object.fromEntries(
          Object.entries(v as Record<string, unknown>).sort(([a], [b]) => (a < b ? -1 : 1)),
        )
      : v,
  );
}
