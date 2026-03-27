import express from "express";
import { createServer } from "http";
import { PORT, INSECURE_TLS } from "./config.js";
import { createProxyRouter } from "./proxy.js";

const app = express();

// HTTP reverse-proxy routes  (/dojo, /github)
app.use(createProxyRouter());

const httpServer = createServer(app);

httpServer.listen(PORT, () => {
  console.log(`[server] HTTP → http://localhost:${PORT}`);
  console.log(`[server] TLS insecure: ${INSECURE_TLS}`);
});
