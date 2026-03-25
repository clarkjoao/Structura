import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage, Server } from "http";
import { WS_PATH } from "./config.js";

interface SignalingMessage {
  type: string;
  topics?: string[];
  topic?: string;
  clients?: number;
  [key: string]: unknown;
}

const topics = new Map<string, Set<WebSocket>>();

function send(conn: WebSocket, message: SignalingMessage): void {
  if (conn.readyState !== WebSocket.OPEN) return;
  try {
    conn.send(JSON.stringify(message));
  } catch {
    // ignore errors from already-closed sockets
  }
}

function onConnect(conn: WebSocket): void {
  const subscribedTopics = new Set<string>();

  conn.on("message", (rawData: Buffer | string) => {
    let message: SignalingMessage;
    try {
      message = JSON.parse(rawData.toString());
    } catch {
      return;
    }

    switch (message.type) {
      case "subscribe": {
        for (const topic of message.topics ?? []) {
          if (!topics.has(topic)) topics.set(topic, new Set());
          topics.get(topic)!.add(conn);
          subscribedTopics.add(topic);
        }
        break;
      }

      case "unsubscribe": {
        for (const topic of message.topics ?? []) {
          subscribedTopics.delete(topic);
          topics.get(topic)?.delete(conn);
        }
        break;
      }

      case "publish": {
        const room = message.topic;
        if (!room) break;

        const receivers = topics.get(room);
        if (!receivers) break;

        const enriched: SignalingMessage = {
          ...message,
          clients: receivers.size,
        };

        for (const receiver of receivers) {
          if (receiver !== conn) send(receiver, enriched);
        }
        break;
      }

      case "ping":
        send(conn, { type: "pong" });
        break;

      default:
        break;
    }
  });

  conn.on("close", () => {
    for (const topic of subscribedTopics) {
      const room = topics.get(topic);
      room?.delete(conn);
      if (room?.size === 0) topics.delete(topic);
    }
  });
}

export function attachSignalingServer(httpServer: Server): WebSocketServer {
  const wss = new WebSocketServer({ server: httpServer, path: WS_PATH });

  wss.on("connection", (conn: WebSocket, _req: IncomingMessage) => {
    onConnect(conn);
  });

  return wss;
}
