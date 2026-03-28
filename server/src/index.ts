import express from "express";
import { createServer } from "http";
import { PORT, INSECURE_TLS, WS_PATH } from "./config.js";
import { createProxyRouter } from "./proxy.js";
import { attachCollabServer } from "./collab.js";

const app = express();

// HTTP reverse-proxy routes  (/dojo, /github)
app.use(createProxyRouter());

const httpServer = createServer(app);
attachCollabServer(httpServer);

httpServer.listen(PORT, () => {
  console.log(`[server] HTTP → http://localhost:${PORT}`);
  console.log(`[server] WS   → ws://localhost:${PORT}${WS_PATH}`);
  console.log(`[server] TLS insecure: ${INSECURE_TLS}`);
});
