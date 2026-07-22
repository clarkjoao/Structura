import express from "express";
import cors from "cors";
import http from "http";
import https from "https";
import fs from "fs";
import { SSL_KEY_PATH, SSL_CERT_PATH } from "./config.js";

export function createApp(): express.Application {
  const app = express();

  // Enable CORS for proxy routes (development only)
  app.use(
    "/proxy",
    cors({
      origin: true, // Allow all origins in development
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"],
      allowedHeaders: ["Content-Type", "Authorization", "Accept", "X-GitHub-Api-Version"],
      credentials: true,
    }),
  );

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  return app;
}

export function createServer(app: express.Application): http.Server {
  if (SSL_KEY_PATH && SSL_CERT_PATH) {
    const key = fs.readFileSync(SSL_KEY_PATH);
    const cert = fs.readFileSync(SSL_CERT_PATH);
    return https.createServer({ key, cert }, app);
  }
  return http.createServer(app);
}

export const isTLS = Boolean(SSL_KEY_PATH && SSL_CERT_PATH);
