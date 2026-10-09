import {
  chunkString,
  COLLAB_PROTOCOL_VERSION,
  isRecord,
  type ClientMessage,
  type CollabUser,
  type DiagramPatch,
  type DiagramState,
  type ServerMessage,
} from "../protocol.js";
import { CollabRelay, type Conn, type RelayOptions } from "../relay.js";
import type { RoomStore } from "../store/types.js";

/** An in-process socket for relay tests: records what the relay sends. */
export class FakeClient implements Conn {
  readonly received: ServerMessage[] = [];
  closed: { code: number; reason: string } | null = null;
  queued = 0;
  private handlers: { onMessage: (raw: string) => void; onClose: () => void } | null = null;
  private waiters: Array<{
    match: (m: ServerMessage) => boolean;
    resolve: (m: ServerMessage) => void;
  }> = [];

  constructor(readonly user: CollabUser) {}

  attach(relay: CollabRelay): this {
    this.handlers = relay.connect(this);
    return this;
  }

  // Conn
  send(text: string): void {
    const parsed: unknown = JSON.parse(text);
    if (!isRecord(parsed)) throw new Error("relay sent a non-object frame");
    const message = parsed as ServerMessage;
    this.received.push(message);
    for (const waiter of [...this.waiters]) {
      if (waiter.match(message)) {
        this.waiters.splice(this.waiters.indexOf(waiter), 1);
        waiter.resolve(message);
      }
    }
  }
  close(code: number, reason: string): void {
    if (this.closed) return;
    this.closed = { code, reason };
    this.handlers?.onClose();
  }
  bufferedAmount(): number {
    return this.queued;
  }

  /** Client side of the socket. */
  write(message: ClientMessage | Record<string, unknown>): void {
    this.handlers?.onMessage(JSON.stringify(message));
  }
  writeRaw(raw: string): void {
    this.handlers?.onMessage(raw);
  }
  drop(): void {
    this.close(1006, "dropped");
  }

  next<T extends ServerMessage["type"]>(
    type: T,
    predicate: (m: Extract<ServerMessage, { type: T }>) => boolean = () => true,
    timeoutMs = 5_000,
  ): Promise<Extract<ServerMessage, { type: T }>> {
    const match = (m: ServerMessage) =>
      m.type === type && predicate(m as Extract<ServerMessage, { type: T }>);
    const already = this.received.find(match);
    if (already) return Promise.resolve(already as Extract<ServerMessage, { type: T }>);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`${this.user.name}: timed out waiting for ${type}`));
      }, timeoutMs);
      this.waiters.push({
        match,
        resolve: (m) => {
          clearTimeout(timer);
          resolve(m as Extract<ServerMessage, { type: T }>);
        },
      });
    });
  }

  all<T extends ServerMessage["type"]>(type: T): Array<Extract<ServerMessage, { type: T }>> {
    return this.received.filter((m) => m.type === type) as Array<
      Extract<ServerMessage, { type: T }>
    >;
  }

  errors(): string[] {
    return this.all("error").map((e) => e.code);
  }
}

export function user(name: string): CollabUser {
  return { id: `${name}-id`, name, color: "#336699" };
}

export async function hostRoom(
  relay: CollabRelay,
  roomId: string,
  seed: DiagramState,
  host = new FakeClient(user("host")),
  hostToken?: string,
): Promise<{ host: FakeClient; hostToken: string; epoch: string }> {
  host.attach(relay);
  const text = JSON.stringify(seed);
  const chunks = chunkString(text);
  host.write({
    type: "create",
    protocol: COLLAB_PROTOCOL_VERSION,
    roomId,
    user: host.user,
    seedChars: text.length,
    seedChunks: chunks.length,
    ...(hostToken ? { hostToken } : {}),
  });
  const created = await host.next("created");
  chunks.forEach((data, index) => host.write({ type: "seed:chunk", index, data }));
  host.write({ type: "seed:commit" });
  const joined = await host.next("joined");
  return { host, hostToken: created.hostToken, epoch: joined.epoch };
}

export async function joinRoom(
  relay: CollabRelay,
  roomId: string,
  client: FakeClient,
  extra: { hostToken?: string; resumeFrom?: number; resumeEpoch?: string } = {},
): Promise<Extract<ServerMessage, { type: "joined" }>> {
  client.attach(relay);
  client.write({
    type: "join",
    protocol: COLLAB_PROTOCOL_VERSION,
    roomId,
    user: client.user,
    ...extra,
  });
  return client.next("joined");
}

/** Reassemble the snapshot a client received after its join. */
export async function receivedSnapshot(client: FakeClient): Promise<DiagramState> {
  await client.next("snapshot:end");
  const chunks = client.all("snapshot:chunk").sort((a, b) => a.index - b.index);
  return JSON.parse(chunks.map((c) => c.data).join("")) as DiagramState;
}

let opCounter = 0;
export function patch(client: FakeClient, diagramPatch: DiagramPatch, baseVersion: number): string {
  const opId = `op-${++opCounter}`;
  client.write({ type: "patch", opId, baseVersion, patch: diagramPatch });
  return opId;
}

export function makeRelay(store: RoomStore, options: RelayOptions = {}): CollabRelay {
  return new CollabRelay(store, { log: () => {}, ...options });
}

export const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
