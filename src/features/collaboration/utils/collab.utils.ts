import { COLLAB_PROTOCOL_VERSION, isRecord } from "@collab-protocol";
import type { SocketLike } from "../sync/CollabClient";

export function newCollabRoomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `room-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
}

/** `incompatible`: something answers at the URL, but not a relay of this protocol version. */
export type ServerCheck = "ok" | "offline" | "incompatible";

interface TestServerOptions {
  timeoutMs?: number;
  createSocket?: (url: string) => SocketLike;
}

/**
 * Check that the URL serves a relay this client can use. An open socket is not enough — a relay
 * of another protocol version accepts the connection and then refuses every handshake — so the
 * probe asks to join a room that cannot exist: a compatible relay answers `room_unknown`.
 */
export function testServer(wsUrl: string, options: TestServerOptions = {}): Promise<ServerCheck> {
  const timeoutMs = options.timeoutMs ?? 4000;
  const createSocket =
    options.createSocket ?? ((url: string) => new WebSocket(url) as unknown as SocketLike);

  return new Promise((resolve) => {
    let done = false;
    let opened = false;
    let ws: SocketLike | null = null;

    const settle = (result: ServerCheck) => {
      if (done) return;
      done = true;
      clearTimeout(timeout);
      try {
        ws?.close();
      } catch (err) {
        console.warn("[CollabUtils] Failed to close WebSocket:", err);
      }
      resolve(result);
    };

    // Open but silent is not a relay of this protocol either.
    const timeout = setTimeout(() => settle(opened ? "incompatible" : "offline"), timeoutMs);

    try {
      ws = createSocket(wsUrl);
      ws.onopen = () => {
        opened = true;
        ws?.send(
          JSON.stringify({
            type: "join",
            protocol: COLLAB_PROTOCOL_VERSION,
            roomId: `probe-${newCollabRoomId()}`,
            user: { id: "probe", name: "probe", color: "#000000" },
          }),
        );
      };
      ws.onmessage = (event) => {
        let message: unknown;
        try {
          message = typeof event.data === "string" ? JSON.parse(event.data) : null;
        } catch {
          message = null;
        }
        if (!isRecord(message)) return settle("incompatible");
        if (message.type === "ping" || message.type === "pong") return;
        if (message.type === "error" && message.code === "room_unknown") return settle("ok");
        // A compatible relay whose room store is down cannot serve a session right now.
        if (message.type === "error" && message.code === "unavailable") return settle("offline");
        settle("incompatible");
      };
      ws.onerror = () => settle("offline");
      ws.onclose = () => settle("offline");
    } catch {
      settle("offline");
    }
  });
}
