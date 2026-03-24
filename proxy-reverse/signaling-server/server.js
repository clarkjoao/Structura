import { WebSocketServer } from "ws";

const PORT = process.env.PORT || 4444;
const wss = new WebSocketServer({ port: PORT });

// Map<topic, Set<WebSocket>>
const topics = new Map();

function send(conn, message) {
  if (conn.readyState !== conn.OPEN) return;
  try {
    conn.send(JSON.stringify(message));
  } catch {
    // Ignore send errors from disconnected peers.
  }
}

wss.on("connection", (conn) => {
  const subscribedTopics = new Set();

  conn.on("message", (rawData) => {
    let message;
    try {
      message = JSON.parse(rawData.toString());
    } catch {
      return;
    }

    switch (message.type) {
      case "subscribe": {
        const subscriptions = message.topics ?? [];
        subscriptions.forEach((topic) => {
          if (!topics.has(topic)) topics.set(topic, new Set());
          topics.get(topic).add(conn);
          subscribedTopics.add(topic);
        });
        break;
      }
      case "unsubscribe": {
        const subscriptions = message.topics ?? [];
        subscriptions.forEach((topic) => {
          subscribedTopics.delete(topic);
          topics.get(topic)?.delete(conn);
        });
        break;
      }
      case "publish": {
        const receivers = topics.get(message.topic);
        if (!receivers) break;
        receivers.forEach((receiver) => {
          if (receiver !== conn) send(receiver, message);
        });
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
    subscribedTopics.forEach((topic) => {
      topics.get(topic)?.delete(conn);
      if (topics.get(topic)?.size === 0) topics.delete(topic);
    });
  });
});

console.log(`[Structura Signaling] listening on ws://localhost:${PORT}`);
