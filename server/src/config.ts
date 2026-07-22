import dotenv from "dotenv";
import path from "path";
import fs from "fs";
import { HttpsProxyAgent } from "https-proxy-agent";
import https from "node:https";

const envPaths = [
  path.resolve(process.cwd(), "../.env"),
  path.resolve(process.cwd(), "../../.env"),
];

const foundEnvPath = envPaths.find((p) => fs.existsSync(p));
if (foundEnvPath) {
  dotenv.config({ path: foundEnvPath });
} else {
  console.warn("[config] No .env file found in expected paths");
}

// ─── Server ──────────────────────────────────────────────────────────────────

export const NODE_ENV = process.env.NODE_ENV ?? "development";
export const IS_PRODUCTION = NODE_ENV === "production";
export const PORT = Number(process.env.PORT ?? 3000);
export const WS_PATH = (() => {
  const raw = process.env.WS_PATH?.trim() || "/ws";
  return raw.startsWith("/") ? raw : `/${raw}`;
})();

// ─── HTTPS (optional) ────────────────────────────────────────────────────────

export const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
export const SSL_CERT_PATH = process.env.SSL_CERT_PATH;

// ─── Proxy ───────────────────────────────────────────────────────────────────

/**
 * Allow insecure TLS certificates (for internal/Corporate networks with self-signed certs)
 */
export const INSECURE_TLS = process.env.PROXY_REVERSE_INSECURE_TLS === "true";

if (INSECURE_TLS) process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

function normalizeProxyUrl(raw: string | undefined): string | undefined {
  const v = raw?.trim();
  if (!v) return undefined;
  return v.startsWith("http://") || v.startsWith("https://") ? v : `http://${v}`;
}

/**
 * Corporate HTTP/HTTPS proxy agent for outbound requests.
 * Used when the server needs to go through a corporate proxy to reach external APIs.
 */
const CORPORATE_PROXY_URL =
  normalizeProxyUrl(process.env.PROXY_REVERSE_INTERNAL_HTTP_PROXY) ||
  normalizeProxyUrl(process.env.PROXY_REVERSE_INTERNAL_HTTPS_PROXY) ||
  normalizeProxyUrl(process.env.HTTP_PROXY) ||
  normalizeProxyUrl(process.env.HTTPS_PROXY);

export const proxyAgent = CORPORATE_PROXY_URL
  ? new HttpsProxyAgent(CORPORATE_PROXY_URL, { keepAlive: true })
  : new https.Agent({ keepAlive: true, rejectUnauthorized: !INSECURE_TLS });
