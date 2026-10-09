/**
 * A minimal protocol-v3 participant for load and acceptance runs, over a real WebSocket.
 * It speaks the same frames as the browser client but keeps only what a measurement needs.
 */
import WebSocket from "ws";
import {
  chunkString,
  COLLAB_PROTOCOL_VERSION,
  type CollabUser,
  type DiagramPatch,
  type DiagramState,
  type ServerMessage,
} from "../src/collab/protocol.js";

export interface ProbeOptions {
  url: string;
  roomId: string;
  user: CollabUser;
  onMessage?: (message: ServerMessage, receivedAt: number) => void;
}

export class Probe {
  ws!: WebSocket;
  version = 0;
  clientId = "";
  hostToken: string | null = null;
  closed = false;
  private waiters: Array<{
    match: (m: ServerMessage) => boolean;
    resolve: (m: ServerMessage) => void;
  }> = [];
  private snapshot: string[] = [];
  state: DiagramState | null = null;

  constructor(readonly opts: ProbeOptions) {}

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.opts.url, { perMessageDeflate: false });
      this.ws.once("open", () => resolve());
      this.ws.once("error", reject);
      this.ws.on("close", () => (this.closed = true));
      this.ws.on("message", (data) => {
        const at = performance.now();
        const message = JSON.parse(data.toString()) as ServerMessage;
        if (message.type === "entry" && message.version > this.version)
          this.version = message.version;
        if (message.type === "joined") {
          this.clientId = message.clientId;
          this.version = message.version;
          this.snapshot = [];
        }
        if (message.type === "snapshot:chunk") this.snapshot[message.index] = message.data;
        if (message.type === "snapshot:end") {
          this.state = JSON.parse(this.snapshot.join("")) as DiagramState;
          this.snapshot = [];
          this.version = message.version;
        }
        if (message.type === "created") this.hostToken = message.hostToken;
        if (message.type === "ping") this.send({ type: "pong" });
        this.opts.onMessage?.(message, at);
        for (const w of [...this.waiters]) {
          if (w.match(message)) {
            this.waiters.splice(this.waiters.indexOf(w), 1);
            w.resolve(message);
          }
        }
      });
    });
  }

  send(message: Record<string, unknown>): void {
    if (this.ws.readyState === WebSocket.OPEN) this.ws.send(JSON.stringify(message));
  }

  next<T extends ServerMessage["type"]>(
    type: T,
    predicate: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true,
    timeoutMs = 30_000,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`timeout waiting for ${type}`)), timeoutMs);
      this.waiters.push({
        match: (m) => m.type === type && predicate(m as Extract<ServerMessage, { type: T }>),
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m as Extract<ServerMessage, { type: T }>);
        },
      });
    });
  }

  /** Create the room and seed it; resolves when the host is joined. */
  async host(seed: DiagramState): Promise<void> {
    const text = JSON.stringify(seed);
    const chunks = chunkString(text);
    const created = this.next("created");
    this.send({
      type: "create",
      protocol: COLLAB_PROTOCOL_VERSION,
      roomId: this.opts.roomId,
      user: this.opts.user,
      seedChars: text.length,
      seedChunks: chunks.length,
    });
    await created;
    const joined = this.next("joined");
    chunks.forEach((data, index) => this.send({ type: "seed:chunk", index, data }));
    this.send({ type: "seed:commit" });
    await joined;
    this.state = seed;
  }

  /** Join as a guest; resolves once the room state has arrived. */
  async join(extra: { hostToken?: string; resumeFrom?: number } = {}): Promise<void> {
    const joined = this.next("joined");
    this.send({
      type: "join",
      protocol: COLLAB_PROTOCOL_VERSION,
      roomId: this.opts.roomId,
      user: this.opts.user,
      ...extra,
    });
    const message = await joined;
    if (!message.catchup) await this.next("snapshot:end");
  }

  patch(patch: DiagramPatch, opId: string): void {
    this.send({ type: "patch", opId, baseVersion: this.version, patch });
  }

  close(): void {
    this.ws.close();
  }
}
