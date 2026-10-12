import express from "express";
import http from "http";
import https from "https";
import fs from "fs";
import { SSL_KEY_PATH, SSL_CERT_PATH } from "./config.js";

/** `ready: false` in the health payload answers 503, so orchestrators route around the pod. */
export function createApp(health: () => Record<string, unknown> = () => ({})): express.Application {
  const app = express();

  app.get("/health", (_req, res) => {
    const details = health();
    const ready = details.ready !== false;
    res
      .status(ready ? 200 : 503)
      .json({ status: ready ? "ok" : "unavailable", uptime: process.uptime(), ...details });
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
