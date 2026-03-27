import { WebSocketServer, WebSocket } from "ws";
import type { IncomingMessage, Server } from "http";
import { WS_PATH } from "./config.js";

interface SignalingMessage {
  type: string;
  topics?: string[];
  topic?: string;
  clients?: number;
  maxPeers?: number;
  code?: string;
  [key: string]: unknown;
}

const topics = new Map<string, Set<WebSocket>>();
const topicHosts = new Map<string, WebSocket>();
const MAX_PEERS = 5;

function removeSubscription(conn: WebSocket, topic: string): void {
  const room = topics.get(topic);
  if (!room) return;

  room.delete(conn);

  if (topicHosts.get(topic) === conn) {
    topicHosts.delete(topic);
  }

  if (room.size === 0) {
    topics.delete(topic);
    topicHosts.delete(topic);
  }
}

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
          const topicPeers = topics.get(topic);
          const isAlreadySubscribed = topicPeers?.has(conn) ?? false;

          if (!isAlreadySubscribed && (topicPeers?.size ?? 0) >= MAX_PEERS) {
            send(conn, {
              type: "error",
              code: "max_peers_reached",
              topic,
              clients: topicPeers?.size ?? 0,
              maxPeers: MAX_PEERS,
            });
            conn.close(1013, "max peers reached");
            return;
          }

          if (!topics.has(topic)) topics.set(topic, new Set());
          topics.get(topic)!.add(conn);
          if (!topicHosts.has(topic)) {
            topicHosts.set(topic, conn);
          }
          subscribedTopics.add(topic);
        }
        break;
      }

      case "unsubscribe": {
        for (const topic of message.topics ?? []) {
          subscribedTopics.delete(topic);
          removeSubscription(conn, topic);
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
      if (!room) continue;

      const isHost = topicHosts.get(topic) === conn;
      room.delete(conn);

      if (isHost) {
        for (const peerConn of room) {
          send(peerConn, { type: "error", code: "host_disconnected", topic });
          peerConn.close(1012, "host disconnected");
        }
        topics.delete(topic);
        topicHosts.delete(topic);
        continue;
      }

      if (room.size === 0) {
        topics.delete(topic);
        topicHosts.delete(topic);
      }
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
