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
  version: number; // Monotonically increasing operation counter
  snapshotAtVersion: number; // Version when last snapshot was taken
  operationLog: Array<{
    version: number;
    operationId: string;
    clientId: string;
    patch: Record<string, unknown>;
    timestamp: number;
  }>;
}

const MAX_OPERATION_LOG_SIZE = 1000; // Keep last 1000 operations for resync

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
const MAX_PARTICIPANTS = 15; // 1 host + 14 guests

// Snapshot configuration
const SNAPSHOT_INTERVAL_OPS = 100; // Take snapshot every N operations
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // Or every 5 minutes (whichever comes first)

// Security and abuse prevention
const MAX_PAYLOAD_SIZE_BYTES = 100 * 1024; // 100KB max payload
const MAX_OPS_PER_SECOND = 50; // Max operations per second per client
const MAX_BATCH_SIZE = 10; // Max patches in a batch

const rooms = new Map<string, Room>();
const socketStates = new Map<WebSocket, SocketState>();
const snapshotTimers = new Map<string, ReturnType<typeof setInterval>>();

// Rate limiting: track operations per client
const clientOpTimestamps = new Map<string, number[]>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseMessage(raw: WebSocket.RawData): JsonMessage | null {
  const data = String(raw);

  // Validate payload size
  if (!validatePayloadSize(data)) {
    return null;
  }

  try {
    const parsed = JSON.parse(data);
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

const DANGEROUS_KEYS = new Set(["__proto__", "constructor", "prototype"]);

/**
 * Validates that a patch object is safe to apply and has a reasonable structure.
 * Prevents prototype pollution attacks and ensures values are JSON-serializable.
 */
function isValidPatch(patch: unknown): patch is Record<string, unknown> {
  if (!isRecord(patch)) return false;

  // Block dangerous keys that could cause prototype pollution
  for (const key of Object.keys(patch)) {
    if (DANGEROUS_KEYS.has(key)) {
      console.warn(`[collab] blocked dangerous patch key: ${key}`);
      return false;
    }
  }

  // Validate that all values are JSON-serializable (no functions, Symbols, etc.)
  for (const value of Object.values(patch)) {
    if (typeof value === "function" || typeof value === "symbol") {
      console.warn("[collab] blocked non-serializable value in patch");
      return false;
    }
    if (typeof value === "bigint") {
      console.warn("[collab] blocked bigint value in patch");
      return false;
    }
  }

  return true;
}

function parsePatch(value: unknown): Record<string, unknown> | null {
  return isRecord(value) && isValidPatch(value) ? value : null;
}

function parseCursor(value: unknown): { x: number; y: number } | null | undefined {
  if (value === null) return null;
  if (!isRecord(value)) return undefined;
  if (typeof value.x !== "number" || typeof value.y !== "number") return undefined;
  return { x: value.x, y: value.y };
}

/**
 * Check if a client is rate limited.
 * Returns true if the client should be rate limited.
 */
function isRateLimited(clientId: string): boolean {
  const now = Date.now();
  const windowMs = 1000; // 1 second window

  let timestamps = clientOpTimestamps.get(clientId) ?? [];
  timestamps = timestamps.filter((t) => now - t < windowMs);

  if (timestamps.length >= MAX_OPS_PER_SECOND) {
    console.warn(`[collab] rate limited: client=${clientId}, ops=${timestamps.length}`);
    return true;
  }

  timestamps.push(now);
  clientOpTimestamps.set(clientId, timestamps);
  return false;
}

/**
 * Clear rate limit data for a client.
 */
function clearRateLimitData(clientId: string): void {
  clientOpTimestamps.delete(clientId);
}

/**
 * Validate payload size.
 * Returns true if payload is within acceptable limits.
 */
function validatePayloadSize(data: string): boolean {
  const sizeBytes = new TextEncoder().encode(data).length;
  if (sizeBytes > MAX_PAYLOAD_SIZE_BYTES) {
    console.warn(`[collab] payload too large: ${sizeBytes} bytes, max=${MAX_PAYLOAD_SIZE_BYTES}`);
    return false;
  }
  return true;
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

  // Stop the periodic snapshot timer
  stopSnapshotTimer(roomId);

  console.log(`[collab] room closed: room=${roomId}, reason=${reason}`);
}

function buildGuestPeers(
  room: Room,
  joiningClientId: string,
): Array<{ clientId: string; user: User }> {
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

  if (
    exceptClientId !== room.hostUser.id &&
    room.hostWs &&
    room.hostWs.readyState === room.hostWs.OPEN
  ) {
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
      version: existingRoom.version,
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
    version: 0,
    snapshotAtVersion: 0,
    operationLog: [],
  };

  rooms.set(roomId, room);

  // Start periodic snapshot timer for this room
  startSnapshotTimer(roomId);
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

  if (roomPeerCount(room) >= MAX_PARTICIPANTS) {
    sendError(ws, "ROOM_FULL", `Room is full (maximum ${MAX_PARTICIPANTS} participants)`, { close: true });
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
    participantCount: roomPeerCount(room),
    maxParticipants: MAX_PARTICIPANTS,
    version: room.version,
    snapshot: room.snapshot,
    hostUser: room.hostUser,
    peers: buildGuestPeers(room, clientId),
  });

  const peerJoinedPayload = {
    type: "peer:joined",
    clientId,
    user: normalizedUser,
    participantCount: roomPeerCount(room),
    maxParticipants: MAX_PARTICIPANTS,
  };
  broadcastToRoom(room, peerJoinedPayload, { exceptClientId: clientId });

  console.log(
    `[collab] guest joined: room=${roomId}, guest=${clientId}, peers=${roomPeerCount(room)}`,
  );
}

/**
 * Generate a unique operation ID (UUID v4).
 * Used for operation tracking and ACK mechanism.
 */
function generateOperationId(): string {
  // Simple UUID v4 generation
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function handleHostPatch(ws: WebSocket, message: JsonMessage): void {
  const state = socketStates.get(ws);
  const roomId = typeof message.roomId === "string" ? message.roomId : null;
  const patch = parsePatch(message.patch);
  const clientOperationId = typeof message.operationId === "string" ? message.operationId : null;
  const clientVersion = typeof message.version === "number" ? message.version : null;

  if (!state || !roomId || !patch || state.roomId !== roomId) {
    sendError(ws, "invalid_host_patch", "Invalid host:patch payload");
    return;
  }

  const room = rooms.get(roomId);
  if (!room || !room.hostWs) {
    sendError(ws, "room_not_found", "Room not found");
    return;
  }

  // Rate limiting check
  if (isRateLimited(state.clientId)) {
    sendError(ws, "rate_limited", "Too many operations per second");
    return;
  }

  // Check batch size if provided
  const batchSize = typeof message.batched === "number" ? message.batched : 1;
  if (batchSize > MAX_BATCH_SIZE) {
    sendError(ws, "batch_too_large", `Batch size exceeds maximum of ${MAX_BATCH_SIZE}`);
    return;
  }

  // Check for version gap - client is behind
  if (clientVersion !== null && clientVersion < room.version - 1) {
    // Client is too far behind, send SYNC_REQUIRED
    safeSend(ws, {
      type: "SYNC_REQUIRED",
      currentVersion: room.version,
      reason: "VERSION_GAP",
    });
    return;
  }

  // Generate operation ID if not provided by client
  const operationId = clientOperationId ?? generateOperationId();

  // Increment version and apply patch
  room.version++;
  applyPatch(room.snapshot, patch);

  // Log operation
  room.operationLog.push({
    version: room.version,
    operationId,
    clientId: state.clientId,
    patch,
    timestamp: Date.now(),
  });

  // Trim operation log if too large
  if (room.operationLog.length > MAX_OPERATION_LOG_SIZE) {
    room.operationLog = room.operationLog.slice(-MAX_OPERATION_LOG_SIZE);
  }

  // Check if we need to take a periodic snapshot
  checkAndTakePeriodicSnapshot(room);

  // Send ACK to the sender with version
  safeSend(ws, {
    type: "OP_ACK",
    operationId,
    version: room.version,
    accepted: true,
  });

  // Broadcast to other clients with operation ID and version
  broadcastToRoom(
    room,
    {
      type: "session:patch",
      patch,
      operationId,
      version: room.version,
    },
    { exceptClientId: state.clientId },
  );
}

function handleGuestPatch(ws: WebSocket, message: JsonMessage): void {
  const state = socketStates.get(ws);
  const roomId = typeof message.roomId === "string" ? message.roomId : null;
  const patch = parsePatch(message.patch);
  const clientOperationId = typeof message.operationId === "string" ? message.operationId : null;
  const clientVersion = typeof message.version === "number" ? message.version : null;

  if (!state || state.role !== "guest" || !roomId || !patch || state.roomId !== roomId) {
    sendError(ws, "invalid_guest_patch", "Invalid guest:patch payload");
    return;
  }

  const room = rooms.get(roomId);
  if (!room) {
    sendError(ws, "room_not_found", "Room not found");
    return;
  }

  // Rate limiting check
  if (isRateLimited(state.clientId)) {
    sendError(ws, "rate_limited", "Too many operations per second");
    return;
  }

  // Check batch size if provided
  const batchSize = typeof message.batched === "number" ? message.batched : 1;
  if (batchSize > MAX_BATCH_SIZE) {
    sendError(ws, "batch_too_large", `Batch size exceeds maximum of ${MAX_BATCH_SIZE}`);
    return;
  }

  // Check for version gap - client is behind
  if (clientVersion !== null && clientVersion < room.version - 1) {
    // Client is too far behind, send SYNC_REQUIRED
    safeSend(ws, {
      type: "SYNC_REQUIRED",
      currentVersion: room.version,
      reason: "VERSION_GAP",
    });
    return;
  }

  // Generate operation ID if not provided by client
  const operationId = clientOperationId ?? generateOperationId();

  // Increment version and apply patch
  room.version++;
  applyPatch(room.snapshot, patch);

  // Log operation
  room.operationLog.push({
    version: room.version,
    operationId,
    clientId: state.clientId,
    patch,
    timestamp: Date.now(),
  });

  // Trim operation log if too large
  if (room.operationLog.length > MAX_OPERATION_LOG_SIZE) {
    room.operationLog = room.operationLog.slice(-MAX_OPERATION_LOG_SIZE);
  }

  // Check if we need to take a periodic snapshot
  checkAndTakePeriodicSnapshot(room);

  // Send ACK to the sender with version
  safeSend(ws, {
    type: "OP_ACK",
    operationId,
    version: room.version,
    accepted: true,
  });

  // Broadcast to all clients (including host) with operation ID and version
  broadcastToRoom(
    room,
    {
      type: "session:patch",
      patch,
      operationId,
      version: room.version,
      clientId: state.clientId,
    },
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

/**
 * Check if periodic snapshot is needed and take it if so.
 * Called after each operation.
 */
function checkAndTakePeriodicSnapshot(room: Room): void {
  // Check if we've accumulated enough operations since last snapshot
  const opsSinceSnapshot = room.version - room.snapshotAtVersion;

  if (opsSinceSnapshot >= SNAPSHOT_INTERVAL_OPS) {
    takePeriodicSnapshot(room);
  }
}

/**
 * Take a periodic snapshot and broadcast it to all clients.
 * This resets the operation log and updates snapshotAtVersion.
 */
function takePeriodicSnapshot(room: Room): void {
  const snapshotVersion = room.version;

  // Broadcast snapshot to all clients
  broadcastToRoom(room, {
    type: "PERIODIC_SNAPSHOT",
    version: snapshotVersion,
    snapshot: { ...room.snapshot },
  });

  // Update snapshot marker
  room.snapshotAtVersion = snapshotVersion;

  // Trim operation log to only keep ops since snapshot
  // This keeps memory bounded while allowing resync
  const opsToKeep = room.operationLog.filter((op) => op.version > room.snapshotAtVersion);
  room.operationLog = opsToKeep;

  console.log(
    `[collab] periodic snapshot: room=${room.hostUser.id}, version=${snapshotVersion}, opsLogged=${room.operationLog.length}`,
  );
}

/**
 * Start the periodic snapshot timer for a room.
 */
function startSnapshotTimer(roomId: string): void {
  // Don't start multiple timers for the same room
  if (snapshotTimers.has(roomId)) {
    return;
  }

  const timer = setInterval(() => {
    const room = rooms.get(roomId);
    if (!room || !room.hostWs) {
      // Room is closed or host disconnected, stop the timer
      const existingTimer = snapshotTimers.get(roomId);
      if (existingTimer) {
        clearInterval(existingTimer);
        snapshotTimers.delete(roomId);
      }
      return;
    }

    // Take snapshot if there have been operations since last snapshot
    const opsSinceSnapshot = room.version - room.snapshotAtVersion;
    if (opsSinceSnapshot > 0) {
      takePeriodicSnapshot(room);
    }
  }, SNAPSHOT_INTERVAL_MS);

  snapshotTimers.set(roomId, timer);
  console.log(`[collab] snapshot timer started: room=${roomId}, interval=${SNAPSHOT_INTERVAL_MS}ms`);
}

/**
 * Stop the periodic snapshot timer for a room.
 */
function stopSnapshotTimer(roomId: string): void {
  const timer = snapshotTimers.get(roomId);
  if (timer) {
    clearInterval(timer);
    snapshotTimers.delete(roomId);
    console.log(`[collab] snapshot timer stopped: room=${roomId}`);
  }
}

function handleSocketClose(ws: WebSocket): void {
  const state = socketStates.get(ws);
  if (!state) return;

  clearSocketHeartbeat(state);
  clearRateLimitData(state.clientId);
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

  // Clear rate limit data for this client
  clearRateLimitData(state.clientId);

  broadcastToRoom(room, {
    type: "peer:left",
    clientId: state.clientId,
    participantCount: roomPeerCount(room),
    maxParticipants: MAX_PARTICIPANTS,
  });

  console.log(`[collab] guest left: room=${state.roomId}, guest=${state.clientId}`);
}

function handleHeartbeatPong(ws: WebSocket): void {
  const state = socketStates.get(ws);
  if (!state) return;
  state.awaitingPong = false;
  clearSocketHeartbeat(state);
}

function handleSyncRequest(ws: WebSocket, message: JsonMessage): void {
  const state = socketStates.get(ws);
  const roomId = typeof message.roomId === "string" ? message.roomId : null;
  const baseVersion = typeof message.baseVersion === "number" ? message.baseVersion : 0;

  if (!state || !roomId || state.roomId !== roomId) {
    sendError(ws, "invalid_sync_request", "Invalid sync:request payload");
    return;
  }

  const room = rooms.get(roomId);
  if (!room) {
    sendError(ws, "room_not_found", "Room not found");
    return;
  }

  // If client is behind snapshot, send snapshot + reset
  // Client will apply the snapshot and continue from there
  if (baseVersion < room.snapshotAtVersion) {
    safeSend(ws, {
      type: "SYNC_SNAPSHOT",
      version: room.version,
      snapshot: room.snapshot,
      snapshotVersion: room.snapshotAtVersion,
    });
    return;
  }

  // Get operations since baseVersion
  const opsSinceBase = room.operationLog.filter((op) => op.version > baseVersion);

  if (opsSinceBase.length === 0) {
    // Already up to date
    safeSend(ws, {
      type: "SYNC_COMPLETE",
      version: room.version,
      operations: [],
    });
    return;
  }

  if (opsSinceBase.length > MAX_OPERATION_LOG_SIZE) {
    // Too many operations to replay, send full snapshot instead
    safeSend(ws, {
      type: "SYNC_SNAPSHOT",
      version: room.version,
      snapshot: room.snapshot,
    });
    return;
  }

  // Send incremental sync
  safeSend(ws, {
    type: "SYNC_COMPLETE",
    version: room.version,
    operations: opsSinceBase.map((op) => ({
      version: op.version,
      operationId: op.operationId,
      patch: op.patch,
      clientId: op.clientId,
    })),
  });
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
        case "sync:request":
          handleSyncRequest(ws, message);
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
