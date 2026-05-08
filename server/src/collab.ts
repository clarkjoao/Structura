import type { Server as HttpServer } from "http";
import { WebSocketServer, type WebSocket } from "ws";
import { WS_PATH } from "./config.js";

interface User {
  id: string;
  name: string;
  color: string;
}

interface Room {
  hostWs: WebSocket | null;
  hostUser: User;
  snapshot: Record<string, unknown>;
  guests: Map<string, { ws: WebSocket; user: User }>;
  reconnectTimer?: ReturnType<typeof setTimeout>;
}

type JsonMessage = Record<string, unknown>;

type SocketRole = "host" | "guest";

interface SocketState {
  roomId: string;
  clientId: string;
  role: SocketRole;
  awaitingPong: boolean;
  pongTimeout: ReturnType<typeof setTimeout> | null;
}

const HEARTBEAT_INTERVAL_MS = 30_000;
const HEARTBEAT_TIMEOUT_MS = 10_000;
const MAX_ROOM_PEERS = 5; // 1 host + 4 guests

const rooms = new Map<string, Room>();
const socketStates = new Map<WebSocket, SocketState>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMessage(raw: WebSocket.RawData): JsonMessage | null {
  try {
    const parsed = JSON.parse(String(raw));
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function parseUser(value: unknown): User | null {
  if (!isRecord(value)) return null;
  if (typeof value.id !== "string") return null;
  if (typeof value.name !== "string") return null;
  if (typeof value.color !== "string") return null;
  return {
    id: value.id,
    name: value.name,
    color: value.color,
  };
}

function parsePatch(value: unknown): Record<string, unknown> | null {
  return isRecord(value) ? value : null;
}

function parseCursor(value: unknown): { x: number; y: number } | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  if (typeof value.x !== "number" || typeof value.y !== "number") return undefined;
  return { x: value.x, y: value.y };
}

function safeSend(ws: WebSocket, payload: Record<string, unknown>): void {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(payload));
}

function sendError(
  ws: WebSocket,
  code: string,
  message: string,
  options: { close?: boolean } = {},
): void {
  safeSend(ws, { type: "error", code, message });
  if (options.close && ws.readyState === ws.OPEN) {
    ws.close(1008, code);
  }
}

function clearSocketHeartbeat(state: SocketState): void {
  if (!state.pongTimeout) return;
  clearTimeout(state.pongTimeout);
  state.pongTimeout = null;
  state.awaitingPong = false;
}

function closeGuestSockets(room: Room): void {
  for (const [guestClientId, guest] of room.guests.entries()) {
    const guestState = socketStates.get(guest.ws);
    if (guestState) {
      clearSocketHeartbeat(guestState);
      socketStates.delete(guest.ws);
    }
    if (guest.ws.readyState === guest.ws.OPEN || guest.ws.readyState === guest.ws.CONNECTING) {
      guest.ws.close(1000, "room_closed");
    }
    console.log(`[collab] guest disconnected: room=${guestClientId}`);
  }
}

function closeRoom(roomId: string, reason: "session:closed" | "host:disconnected"): void {
  const room = rooms.get(roomId);
  if (!room) return;

  if (room.reconnectTimer) {
    clearTimeout(room.reconnectTimer);
    room.reconnectTimer = undefined;
  }

  rooms.delete(roomId);

  const msgType = reason === "session:closed" ? "session:closed" : "host:disconnected";
  for (const guest of room.guests.values()) {
    safeSend(guest.ws, { type: msgType });
  }

  closeGuestSockets(room);

  if (room.hostWs) {
    const hostState = socketStates.get(room.hostWs);
    if (hostState) {
      clearSocketHeartbeat(hostState);
      socketStates.delete(room.hostWs);
    }
  }

  console.log(`[collab] room closed: room=${roomId}, reason=${reason}`);
}

function buildGuestPeers(room: Room, joiningClientId: string): Array<{ clientId: string; user: User }> {
  return Array.from(room.guests.entries())
    .filter(([clientId]) => clientId !== joiningClientId)
    .map(([clientId, guest]) => ({ clientId, user: guest.user }));
}

function roomPeerCount(room: Room): number {
  return 1 + room.guests.size;
}

function broadcastToRoom(
  room: Room,
  payload: Record<string, unknown>,
  options: { exceptClientId?: string } = {},
): void {
  const { exceptClientId } = options;

  if (exceptClientId !== room.hostUser.id && room.hostWs && room.hostWs.readyState === room.hostWs.OPEN) {
    safeSend(room.hostWs, payload);
  }

  for (const [clientId, guest] of room.guests.entries()) {
    if (clientId === exceptClientId) continue;
    safeSend(guest.ws, payload);
  }
}

function ensureUniqueGuestId(room: Room, desiredId: string): string {
  const fallbackBase = desiredId.trim() || `guest-${Math.random().toString(36).slice(2, 10)}`;
  let candidate = fallbackBase;
  while (candidate === room.hostUser.id || room.guests.has(candidate)) {
    candidate = `${fallbackBase}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return candidate;
}

function applyPatch(snapshot: Record<string, unknown>, patch: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(patch)) {
    snapshot[key] = value;
  }
}

function handleHostJoin(ws: WebSocket, message: JsonMessage): void {
  const roomId = typeof message.roomId === "string" ? message.roomId : null;
  const diagramIdMeta = typeof message.diagramId === "string" ? message.diagramId : null;
  const user = parseUser(message.user);
  const snapshot = parsePatch(message.snapshot);

  if (!roomId || !user || !snapshot) {
    sendError(ws, "invalid_host_join", "Invalid host:join payload");
    return;
  }

  const existingRoom = rooms.get(roomId);

  if (existingRoom && existingRoom.hostWs === null) {
    if (existingRoom.reconnectTimer) {
      clearTimeout(existingRoom.reconnectTimer);
      existingRoom.reconnectTimer = undefined;
    }

    existingRoom.hostWs = ws;
    existingRoom.hostUser = user;

    socketStates.set(ws, {
      roomId,
      clientId: user.id,
      role: "host",
      awaitingPong: false,
      pongTimeout: null,
    });

    safeSend(ws, {
      type: "host:ack",
      resumed: true,
      snapshot: existingRoom.snapshot,
    });

    for (const [clientId, guest] of existingRoom.guests.entries()) {
      safeSend(ws, {
        type: "peer:joined",
        clientId,
        user: guest.user,
      });
    }

    for (const guest of existingRoom.guests.values()) {
      safeSend(guest.ws, { type: "host:reconnected" });
    }

    console.log(
      `[collab] host reconnected: room=${roomId}, diagram=${diagramIdMeta ?? "n/a"}, host=${user.id}`,
    );
    return;
  }

  if (rooms.has(roomId)) {
    sendError(ws, "room_exists", "Room already exists", { close: true });
    return;
  }

  const room: Room = {
    hostWs: ws,
    hostUser: user,
    snapshot: { ...snapshot },
    guests: new Map(),
  };

  rooms.set(roomId, room);
  socketStates.set(ws, {
    roomId,
    clientId: user.id,
    role: "host",
    awaitingPong: false,
    pongTimeout: null,
  });

  safeSend(ws, { type: "host:ack", resumed: false });
  console.log(
    `[collab] host joined: room=${roomId}, diagram=${diagramIdMeta ?? "none"}, host=${user.id}`,
  );
}

function handleGuestJoin(ws: WebSocket, message: JsonMessage): void {
  const roomId = typeof message.roomId === "string" ? message.roomId : null;
  const user = parseUser(message.user);

  if (!roomId || !user) {
    sendError(ws, "invalid_guest_join", "Invalid guest:join payload");
    return;
  }

  const room = rooms.get(roomId);
  if (!room) {
    sendError(ws, "room_not_found", "Room not found");
    return;
  }

  if (roomPeerCount(room) >= MAX_ROOM_PEERS) {
    sendError(ws, "room_full", "Room is full", { close: true });
    return;
  }

  const clientId = ensureUniqueGuestId(room, user.id);
  const normalizedUser = { ...user, id: clientId };

  room.guests.set(clientId, { ws, user: normalizedUser });
  socketStates.set(ws, {
    roomId,
    clientId,
    role: "guest",
    awaitingPong: false,
    pongTimeout: null,
  });

  safeSend(ws, {
    type: "session:init",
    snapshot: room.snapshot,
    hostUser: room.hostUser,
    peers: buildGuestPeers(room, clientId),
  });

  const peerJoinedPayload = {
    type: "peer:joined",
    clientId,
    user: normalizedUser,
  };
  broadcastToRoom(room, peerJoinedPayload, { exceptClientId: clientId });

  console.log(`[collab] guest joined: room=${roomId}, guest=${clientId}, peers=${roomPeerCount(room)}`);
}

function handleHostPatch(ws: WebSocket, message: JsonMessage): void {
  const state = socketStates.get(ws);
  const roomId = typeof message.roomId === "string" ? message.roomId : null;
  const patch = parsePatch(message.patch);

  if (!state || !roomId || !patch || state.roomId !== roomId) {
    sendError(ws, "invalid_host_patch", "Invalid host:patch payload");
    return;
  }

  const room = rooms.get(roomId);
  if (!room || !room.hostWs) {
    sendError(ws, "room_not_found", "Room not found");
    return;
  }

  applyPatch(room.snapshot, patch);

  broadcastToRoom(
    room,
    {
      type: "session:patch",
      patch,
    },
    { exceptClientId: state.clientId },
  );
}

function handleGuestPatch(ws: WebSocket, message: JsonMessage): void {
  const state = socketStates.get(ws);
  const roomId = typeof message.roomId === "string" ? message.roomId : null;
  const patch = parsePatch(message.patch);

  if (!state || state.role !== "guest" || !roomId || !patch || state.roomId !== roomId) {
    sendError(ws, "invalid_guest_patch", "Invalid guest:patch payload");
    return;
  }

  const room = rooms.get(roomId);
  if (!room) {
    sendError(ws, "room_not_found", "Room not found");
    return;
  }

  applyPatch(room.snapshot, patch);

  broadcastToRoom(
    room,
    { type: "session:patch", patch },
    { exceptClientId: state.clientId },
  );
}

function handleHostClose(ws: WebSocket, message: JsonMessage): void {
  const state = socketStates.get(ws);
  const roomId = typeof message.roomId === "string" ? message.roomId : null;

  if (!state || state.role !== "host" || !roomId || state.roomId !== roomId) {
    sendError(ws, "invalid_host_close", "Invalid host:close payload");
    return;
  }

  closeRoom(roomId, "session:closed");
}

function handlePeerCursor(ws: WebSocket, message: JsonMessage): void {
  const state = socketStates.get(ws);
  const roomId = typeof message.roomId === "string" ? message.roomId : null;
  const cursor = parseCursor(message.cursor);
  const activeElementId =
    typeof message.activeElementId === "string" || message.activeElementId === null
      ? message.activeElementId
      : null;

  if (!state || !roomId || state.roomId !== roomId || cursor === undefined) {
    sendError(ws, "invalid_peer_cursor", "Invalid peer:cursor payload");
    return;
  }

  const room = rooms.get(roomId);
  if (!room) {
    sendError(ws, "room_not_found", "Room not found");
    return;
  }

  const isHost = state.role === "host";
  const user = isHost ? room.hostUser : room.guests.get(state.clientId)?.user;
  if (!user) return;

  const payload = {
    type: "peer:cursor",
    clientId: state.clientId,
    user,
    cursor,
    activeElementId,
  };

  broadcastToRoom(room, payload, { exceptClientId: state.clientId });
}

function handleSocketClose(ws: WebSocket): void {
  const state = socketStates.get(ws);
  if (!state) return;

  clearSocketHeartbeat(state);
  socketStates.delete(ws);

  const room = rooms.get(state.roomId);
  if (!room) return;

  if (state.role === "host") {
    for (const guest of room.guests.values()) {
      safeSend(guest.ws, { type: "host:reconnecting" });
    }

    room.reconnectTimer = setTimeout(() => {
      room.reconnectTimer = undefined;
      console.log(`[collab] host reconnect timeout: room=${state.roomId}`);
      closeRoom(state.roomId, "host:disconnected");
    }, 10_000);

    room.hostWs = null;
    return;
  }

  const removed = room.guests.delete(state.clientId);
  if (!removed) return;

  broadcastToRoom(room, {
    type: "peer:left",
    clientId: state.clientId,
  });

  console.log(`[collab] guest left: room=${state.roomId}, guest=${state.clientId}`);
}

function handleHeartbeatPong(ws: WebSocket): void {
  const state = socketStates.get(ws);
  if (!state) return;
  state.awaitingPong = false;
  clearSocketHeartbeat(state);
}

function startHeartbeat(): ReturnType<typeof setInterval> {
  return setInterval(() => {
    for (const [ws, state] of socketStates.entries()) {
      if (ws.readyState !== ws.OPEN) continue;

      clearSocketHeartbeat(state);
      state.awaitingPong = true;
      safeSend(ws, { type: "ping" });

      state.pongTimeout = setTimeout(() => {
        if (!state.awaitingPong) return;
        console.log(`[collab] heartbeat timeout: room=${state.roomId}, client=${state.clientId}`);
        try {
          ws.terminate();
        } catch {
          // Ignore terminate errors.
        }
      }, HEARTBEAT_TIMEOUT_MS);
    }
  }, HEARTBEAT_INTERVAL_MS);
}

export interface CollabHandle {
  shutdown: () => Promise<void>;
}

export function attachCollabServer(httpServer: HttpServer): CollabHandle {
  const wss = new WebSocketServer({ server: httpServer, path: WS_PATH });
  const heartbeatInterval = startHeartbeat();

  console.log(`[collab] websocket path: ${WS_PATH}`);

  wss.on("connection", (ws) => {
    console.log("[collab] websocket connected");

    ws.on("message", (raw) => {
      const message = parseMessage(raw);
      if (!message) {
        sendError(ws, "invalid_json", "Invalid JSON message");
        return;
      }

      const messageType = typeof message.type === "string" ? message.type : null;
      
      if (!messageType) {
        sendError(ws, "missing_type", "Message type is required");
        return;
      }
      switch (messageType) {
        case "host:join":
          handleHostJoin(ws, message);
          return;
        case "host:patch":
          handleHostPatch(ws, message);
          return;
        case "guest:patch":
          handleGuestPatch(ws, message);
          return;
        case "host:close":
          handleHostClose(ws, message);
          return;
        case "guest:join":
          handleGuestJoin(ws, message);
          return;
        case "peer:cursor":
          handlePeerCursor(ws, message);
          return;
        case "ping":
          safeSend(ws, { type: "pong" });
          return;
        case "pong":
          handleHeartbeatPong(ws);
          return;
        default:
          sendError(ws, "unsupported_message", `Unsupported message type: ${messageType}`);
      }
    });

    ws.on("close", () => {
      handleSocketClose(ws);
    });

    ws.on("error", (error) => {
      console.log("[collab] websocket error", error);
    });
  });

  wss.on("close", () => {
    clearInterval(heartbeatInterval);
  });

  return {
    shutdown: () =>
      new Promise((resolve) => {
        clearInterval(heartbeatInterval);
        for (const ws of wss.clients) {
          ws.close(1001, "server_shutdown");
        }
        wss.close(() => resolve());
      }),
  };
}
