import type { SocketLike } from "../sync/CollabClient";

/**
 * The relay is server code (Node types); the app's type check has no Node lib, so it is loaded at
 * runtime and described here by the little the rig uses.
 */
interface RelayConn {
  send(text: string): void;
  close(code: number, reason: string): void;
  bufferedAmount(): number;
}
interface RelayLike {
  connect(conn: RelayConn): { onMessage: (raw: string) => void; onClose: () => void };
  stop(): Promise<void>;
}
interface RoomStoreLike {
  discardRoom(roomId: string): Promise<void>;
  getMeta(roomId: string): Promise<{ status: string; version: number } | null>;
  close(): Promise<void>;
}
type RelayOptions = Record<string, unknown>;

const RELAY_MODULE = "../../../../server/src/collab/relay.ts";
const STORE_MODULE = "../../../../server/src/collab/store/memory.ts";

/**
 * The real relay, in process, behind fake sockets that deliver asynchronously like a network.
 * Client tests run against it so the protocol is exercised end to end, not mocked.
 */

export class FakeSocket implements SocketLike {
  readyState = 0;
  onopen: ((event: unknown) => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: unknown) => void) | null = null;
  onerror: ((event: unknown) => void) | null = null;
  sent: string[] = [];
  private server: { onMessage: (raw: string) => void; onClose: () => void } | null = null;

  constructor(
    private readonly rig: Rig,
    readonly url: string,
  ) {
    queueMicrotask(() => {
      if (this.readyState === 3) return;
      if (!rig.online) {
        this.readyState = 3;
        this.onclose?.({});
        return;
      }
      this.server = rig.relay.connect({
        send: (text) => {
          // Like a real socket, frames already in flight still arrive before the close.
          queueMicrotask(() => {
            if (!this.closedByClient) this.onmessage?.({ data: text });
          });
        },
        close: () => this.drop(),
        bufferedAmount: () => 0,
      });
      this.readyState = 1;
      this.onopen?.({});
    });
  }

  send(data: string): void {
    if (this.readyState !== 1) return;
    this.sent.push(data);
    const server = this.server;
    queueMicrotask(() => server?.onMessage(data));
  }

  private closedByClient = false;

  close(): void {
    this.closedByClient = true;
    this.drop();
  }

  /** The network went away under this socket. */
  drop(): void {
    if (this.readyState === 3) return;
    this.readyState = 3;
    const server = this.server;
    this.server = null;
    queueMicrotask(() => {
      server?.onClose();
      this.onclose?.({});
    });
  }

  sentTypes(): string[] {
    return this.sent.map((raw) => (JSON.parse(raw) as { type: string }).type);
  }
}

export interface Rig {
  relay: RelayLike;
  store: RoomStoreLike;
  sockets: FakeSocket[];
  online: boolean;
  createSocket: (url: string) => FakeSocket;
  stop: () => Promise<void>;
}

export async function createRig(options: RelayOptions = {}): Promise<Rig> {
  const { CollabRelay } = (await import(/* @vite-ignore */ RELAY_MODULE)) as {
    CollabRelay: new (store: RoomStoreLike, options: RelayOptions) => RelayLike;
  };
  const { MemoryRoomStore } = (await import(/* @vite-ignore */ STORE_MODULE)) as {
    MemoryRoomStore: new () => RoomStoreLike;
  };
  const store = new MemoryRoomStore();
  const relay = new CollabRelay(store, {
    log: () => {},
    hostGraceMs: 400,
    hostLeaseMs: 100,
    hostLeaseRenewMs: 30,
    reaperIntervalMs: 20,
    cursorFlushMs: 20,
    ...options,
  });
  const rig: Rig = {
    relay,
    store,
    sockets: [],
    online: true,
    createSocket: (url) => {
      const socket = new FakeSocket(rig, url);
      rig.sockets.push(socket);
      return socket;
    },
    stop: async () => {
      await relay.stop();
      await store.close();
    },
  };
  return rig;
}

export const tick = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

export async function until(
  check: () => boolean,
  timeoutMs = 3_000,
  what = "condition",
): Promise<void> {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeoutMs) throw new Error(`timed out waiting for ${what}`);
    await tick(5);
  }
}
