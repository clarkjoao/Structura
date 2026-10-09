import {
  PORT,
  WS_PATH,
  IS_PRODUCTION,
  REDIS_URL,
  REDIS_NAMESPACE,
  COLLAB_HOST_GRACE_MS,
  COLLAB_MAX_PARTICIPANTS,
} from "./config.js";
import { createApp, createServer, isTLS } from "./server.js";
import { attachCollabServer, MemoryRoomStore, type RoomStore } from "./collab/index.js";
import { RedisRoomStore } from "./collab/store/redis.js";

const store: RoomStore = REDIS_URL
  ? new RedisRoomStore(REDIS_URL, { namespace: REDIS_NAMESPACE })
  : new MemoryRoomStore();

const app = createApp(() => ({ collab: { store: store.kind } }));

if (!IS_PRODUCTION) {
  const { createProxyRouter } = await import("./proxy.js");
  app.use("/proxy", createProxyRouter());
  console.log("[server] Generic proxy mounted at /proxy (development only)");
}

const httpServer = createServer(app);
const collab = attachCollabServer(httpServer, {
  store,
  relay: { hostGraceMs: COLLAB_HOST_GRACE_MS, maxParticipants: COLLAB_MAX_PARTICIPANTS },
});

const proto = isTLS ? "https" : "http";
const wsProto = isTLS ? "wss" : "ws";

httpServer.listen(PORT, () => {
  console.log(`[server] ${proto.toUpperCase()} → ${proto}://localhost:${PORT}`);
  console.log(`[server] WS   → ${wsProto}://localhost:${PORT}${WS_PATH}`);
  console.log(`[server] ENV  → ${IS_PRODUCTION ? "production" : "development"}`);
  console.log(
    `[server] ROOMS → ${store.kind === "redis" ? "redis (shared)" : "memory (single instance)"}`,
  );
});

async function shutdown(signal: string): Promise<void> {
  console.log(`[server] ${signal} received — shutting down gracefully`);

  await collab.shutdown();

  httpServer.close((err) => {
    if (err) {
      console.error("[server] Error closing HTTP server:", err.message);
      process.exit(1);
    }
    console.log("[server] HTTP server closed");
    process.exit(0);
  });

  setTimeout(() => {
    console.error("[server] Shutdown timeout — forcing exit");
    process.exit(1);
  }, 10_000).unref();
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});
process.on("SIGINT", () => {
  void shutdown("SIGINT");
});
