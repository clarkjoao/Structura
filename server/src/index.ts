import { PORT, WS_PATH, IS_PRODUCTION } from "./config.js";
import { createApp, createServer, isTLS } from "./server.js";
import { attachCollabServer } from "./collab.js";

const app = createApp();

if (!IS_PRODUCTION) {
  const { createProxyRouter } = await import("./proxy.js");
  app.use(createProxyRouter());
  console.log("[server] Proxy router mounted (development only)");
}

const httpServer = createServer(app);
const collab = attachCollabServer(httpServer);

const proto = isTLS ? "https" : "http";
const wsProto = isTLS ? "wss" : "ws";

httpServer.listen(PORT, () => {
  console.log(`[server] ${proto.toUpperCase()} → ${proto}://localhost:${PORT}`);
  console.log(`[server] WS   → ${wsProto}://localhost:${PORT}${WS_PATH}`);
  console.log(`[server] ENV  → ${IS_PRODUCTION ? "production" : "development"}`);
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
