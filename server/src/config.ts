import dotenv from "dotenv";
import path from "path";
import fs from "fs";

const envPaths = [
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../.env"),
  path.resolve(process.cwd(), "../../.env"),
];

const foundEnvPath = envPaths.find((p) => fs.existsSync(p));
if (foundEnvPath) {
  dotenv.config({ path: foundEnvPath });
}

// ─── Server ──────────────────────────────────────────────────────────────────

export const NODE_ENV = process.env.NODE_ENV ?? "development";
export const IS_PRODUCTION = NODE_ENV === "production";
export const PORT = Number(process.env.PORT ?? 3000);
export const WS_PATH = (() => {
  const raw = process.env.WS_PATH?.trim() || "/ws";
  return raw.startsWith("/") ? raw : `/${raw}`;
})();

// ─── Collaboration ───────────────────────────────────────────────────────────

/** Shared room storage. Unset: single instance, rooms in memory. */
export const REDIS_URL = process.env.REDIS_URL?.trim() || undefined;
/** Prefix for every collaboration key, so deployments can share one Redis. */
export const REDIS_NAMESPACE = process.env.REDIS_NAMESPACE?.trim() ?? "";
/** How long a dropped host has to come back before its session closes (default 30 s). */
export const COLLAB_HOST_GRACE_MS = process.env.COLLAB_HOST_GRACE_MS
  ? Number(process.env.COLLAB_HOST_GRACE_MS)
  : undefined;
/** Participants per room (default 50). */
export const COLLAB_MAX_PARTICIPANTS = process.env.COLLAB_MAX_PARTICIPANTS
  ? Number(process.env.COLLAB_MAX_PARTICIPANTS)
  : undefined;

// ─── HTTPS (optional) ────────────────────────────────────────────────────────

export const SSL_KEY_PATH = process.env.SSL_KEY_PATH;
export const SSL_CERT_PATH = process.env.SSL_CERT_PATH;
