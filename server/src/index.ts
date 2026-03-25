import express from "express";
import { createServer } from "http";
import { PORT, WS_PATH, INSECURE_TLS } from "./config.js";
import { createProxyRouter } from "./proxy.js";
import { attachSignalingServer } from "./signaling.js";

const app = express();

// HTTP reverse-proxy routes  (/dojo, /github)
app.use(createProxyRouter());

// Single HTTP server shared by Express + WebSocket
const httpServer = createServer(app);
attachSignalingServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`[server] HTTP  → http://localhost:${PORT}`);
  console.log(`[server] WS    → ws://localhost:${PORT}${WS_PATH}`);
  console.log(`[server] TLS insecure: ${INSECURE_TLS}`);
});
