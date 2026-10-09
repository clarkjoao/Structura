import type { Server as HttpServer } from "node:http";
import type { Server as HttpsServer } from "node:https";
import { WebSocketServer, type WebSocket } from "ws";
import { WS_PATH } from "../config.js";
import { LIMITS } from "./protocol.js";
import { CollabRelay, type RelayOptions } from "./relay.js";
import { MemoryRoomStore } from "./store/memory.js";
import type { RoomStore } from "./store/types.js";

export { CollabRelay } from "./relay.js";
export { MemoryRoomStore } from "./store/memory.js";
export type { RoomStore } from "./store/types.js";

const HEARTBEAT_MS = 30_000;

export interface CollabServer {
  relay: CollabRelay;
  store: RoomStore;
  shutdown(): Promise<void>;
}

/**
 * Attach the v3 relay to an HTTP(S) server. With no store it runs single-instance in memory;
 * pass a `RedisRoomStore` to let any number of relays serve the same rooms.
 */
export function attachCollabServer(
  httpServer: HttpServer | HttpsServer,
  options: { store?: RoomStore; relay?: RelayOptions; path?: string } = {},
): CollabServer {
  const store = options.store ?? new MemoryRoomStore();
  const relay = new CollabRelay(store, options.relay);
  const wss = new WebSocketServer({
    server: httpServer,
    path: options.path ?? WS_PATH,
    // Frames are text; leave headroom over the character cap for multi-byte content.
    maxPayload: LIMITS.maxFrameChars * 4,
  });

  const alive = new WeakMap<WebSocket, boolean>();

  wss.on("connection", (ws) => {
    alive.set(ws, true);
    const handlers = relay.connect({
      send: (text) => {
        if (ws.readyState === ws.OPEN) ws.send(text);
      },
      close: (code, reason) => ws.close(code, reason),
      bufferedAmount: () => ws.bufferedAmount,
    });
    ws.on("pong", () => alive.set(ws, true));
    ws.on("message", (data, isBinary) => {
      if (isBinary) return;
      handlers.onMessage(data.toString());
    });
    ws.on("close", () => handlers.onClose());
    ws.on("error", () => ws.terminate());
  });

  // Transport-level liveness: a socket that misses a ping round is dropped, so its client
  // reconnects and its room membership expires instead of lingering.
  const heartbeat = setInterval(() => {
    for (const ws of wss.clients) {
      if (alive.get(ws) === false) {
        ws.terminate();
        continue;
      }
      alive.set(ws, false);
      ws.ping();
    }
  }, HEARTBEAT_MS);
  heartbeat.unref();

  return {
    relay,
    store,
    async shutdown() {
      clearInterval(heartbeat);
      await relay.stop();
      await new Promise<void>((resolve) => wss.close(() => resolve()));
      await store.close();
    },
  };
}
