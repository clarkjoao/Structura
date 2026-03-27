/**
 * Resolves the best default signaling URL based on environment and current hostname.
 *
 * Priority:
 * 1. VITE_SIGNALING_URL if defined and not pointing to localhost → use directly
 * 2. If the browser hostname is not localhost/127.0.0.1 → build ws://{hostname}:{port}/ws
 * 3. Fallback → VITE_SIGNALING_URL (even if localhost)
 */

const LOCALHOST_PATTERNS = ["localhost", "127.0.0.1"];

export function isLocalhostSignaling(url: string): boolean {
  return LOCALHOST_PATTERNS.some((p) => url.includes(p));
}

function resolvePort(): number {
  const envPort = import.meta.env.VITE_SIGNALING_PORT;
  if (envPort) {
    const parsed = Number(envPort);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  const envUrl = import.meta.env.VITE_SIGNALING_URL;
  if (typeof envUrl === "string") {
    try {
      // ws://host:3000/ws → extract 3000
      const portMatch = envUrl.match(/:(\d+)/);
      if (portMatch) {
        const parsed = Number(portMatch[1]);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
      }
    } catch {
      // Ignore parse errors.
    }
  }
  return 3000;
}

function resolveWsPath(): string {
  const envUrl = import.meta.env.VITE_SIGNALING_URL;
  if (typeof envUrl === "string") {
    try {
      const url = new URL(envUrl);
      return url.pathname !== "/" ? url.pathname : "/ws";
    } catch {
      // Ignore parse errors.
    }
  }
  return "/ws";
}

export function resolveDefaultSignalingUrl(): string {
  const envUrl = import.meta.env.VITE_SIGNALING_URL as string | undefined;

  // 1. Explicit env var that is not localhost → trust it
  if (envUrl && !isLocalhostSignaling(envUrl)) {
    return envUrl;
  }

  // 2. Browser hostname is a real IP/domain → construct URL automatically
  const hostname = typeof window !== "undefined" ? window.location.hostname : "";
  if (hostname && !LOCALHOST_PATTERNS.includes(hostname)) {
    const port = resolvePort();
    const path = resolveWsPath();
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${hostname}:${port}${path}`;
  }

  // 3. Fallback to env or hardcoded localhost
  return envUrl ?? `ws://localhost:${resolvePort()}/ws`;
}
