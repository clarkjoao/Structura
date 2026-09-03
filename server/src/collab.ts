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
    bytes: number;
  }>;
  /** Approximate bytes retained by operationLog, kept in step with it. */
  operationLogBytes: number;
  /** Newest cursor per client, awaiting the next coalesced flush. */
  pendingCursors: Map<string, CursorEntry>;
  cursorTimer: ReturnType<typeof setTimeout> | null;
}

interface CursorEntry {
  clientId: string;
  user: User;
  cursor: { x: number; y: number } | null;
  activeElementId: string | null;
}

const MAX_OPERATION_LOG_SIZE = 1000; // Keep at most this many operations for resync
// ...and at most this many bytes of them. Patches carry whole collections, so
// a busy room on a large diagram can hold hundreds of MB under the count cap
// alone; the byte budget is what actually bounds the relay's heap.
const MAX_OPERATION_LOG_BYTES = 2 * 1024 * 1024;

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

/**
 * Wire protocol version. v2 made patches sparse and per entity — a change that
 * is invisible in the message shape, so a v1 client would read "these entities
 * changed" as "the collection is now only these" and wipe the user's diagram.
 * Joins that do not declare v2 are refused rather than silently corrupted.
 */
const COLLAB_PROTOCOL_VERSION = 2;

/** Reject a join whose client speaks a different protocol version. */
function hasProtocolMismatch(ws: WebSocket, message: JsonMessage): boolean {
  const declared = typeof message.protocol === "number" ? message.protocol : 1;
  if (declared === COLLAB_PROTOCOL_VERSION) return false;

  sendError(
    ws,
    "protocol_mismatch",
    `Unsupported protocol version ${declared}; server speaks ${COLLAB_PROTOCOL_VERSION}. Reload to update.`,
    { close: true },
  );
  return true;
}

// Snapshot configuration
const SNAPSHOT_INTERVAL_OPS = 100; // Take snapshot every N operations
const SNAPSHOT_INTERVAL_MS = 5 * 60 * 1000; // Or every 5 minutes (whichever comes first)

// Security and abuse prevention
const MAX_PAYLOAD_SIZE_BYTES = 100 * 1024; // 100KB max payload
const MAX_OPS_PER_SECOND = 50; // Max operations per second per client
const MAX_BATCH_SIZE = 10; // Max patches in a batch
const RATE_WINDOW_MS = 1000; // Rate limit window
const LOG_THROTTLE_MS = 1000; // Collapse repeated hot-path warnings
const MAX_BUFFERED_BYTES = 1024 * 1024; // Drop lossy frames past 1MB queued per socket
const CURSOR_FLUSH_MS = 50; // Coalesce cursor fan-out to 20Hz per room

const rooms = new Map<string, Room>();
const socketStates = new Map<WebSocket, SocketState>();
const snapshotTimers = new Map<string, ReturnType<typeof setInterval>>();

// Rate limiting: fixed-window counter per room+client (see rateKeyFor).
// A counter avoids the per-op array allocation a sliding window required.
const clientOpTimestamps = new Map<string, { windowStart: number; count: number }>();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Byte length of an inbound frame without copying it.
 *
 * ws hands us a Buffer (or a list of them) whose .length is already the byte
 * count, so the size gate costs nothing. Measuring after String(raw) instead
 * would copy the whole frame twice — once to a JS string, once to a byte
 * array — on every message, which dominates the relay's CPU under load.
 */
function rawByteLength(raw: WebSocket.RawData): number {
  if (typeof raw === "string") return Buffer.byteLength(raw, "utf8");
  if (Array.isArray(raw)) {
    let total = 0;
    for (const chunk of raw) total += chunk.length;
    return total;
  }
  return (raw as Buffer | ArrayBuffer).byteLength ?? (raw as Buffer).length;
}

/**
 * Inbound frame size per parsed message, so the operation log can budget by
 * bytes without re-serialising the patch it already received.
 */
const frameSizes = new WeakMap<JsonMessage, number>();

function parseMessage(raw: WebSocket.RawData): JsonMessage | null {
  // Validate payload size before materialising the frame as a string.
  const sizeBytes = rawByteLength(raw);
  if (sizeBytes > MAX_PAYLOAD_SIZE_BYTES) {
    logThrottled("payload_too_large", `payload too large: ${sizeBytes} bytes`);
    return null;
  }

  try {
    const parsed = JSON.parse(String(raw));
    if (!isRecord(parsed)) return null;
    frameSizes.set(parsed, sizeBytes);
    return parsed;
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
function isRateLimited(rateKey: string): boolean {
  const now = Date.now();

  let bucket = clientOpTimestamps.get(rateKey);
  if (!bucket || now - bucket.windowStart >= RATE_WINDOW_MS) {
    bucket = { windowStart: now, count: 0 };
    clientOpTimestamps.set(rateKey, bucket);
  }

  if (bucket.count >= MAX_OPS_PER_SECOND) {
    logThrottled("rate_limited", `rate limited: key=${rateKey}`);
    return true;
  }

  bucket.count++;
  return false;
}

/**
 * Rate-limit key. Scoped by room so a clientId reused across rooms — the same
 * person in two sessions, or a guest-id collision — cannot consume another
 * room's budget or have its own cleared by an unrelated disconnect.
 */
function rateKeyFor(roomId: string, clientId: string): string {
  return `${roomId} ${clientId}`;
}

/**
 * Clear rate limit data for a client.
 */
function clearRateLimitData(rateKey: string): void {
  clientOpTimestamps.delete(rateKey);
}

/**
 * Per-message logging is a synchronous write on every hot-path event, which
 * is itself a bottleneck under load. Collapse repeats into one line per key
 * per interval, carrying the suppressed count.
 */
const logCounters = new Map<string, { count: number; lastLoggedAt: number }>();

function logThrottled(key: string, message: string): void {
  const now = Date.now();
  let entry = logCounters.get(key);
  if (!entry) {
    entry = { count: 0, lastLoggedAt: 0 };
    logCounters.set(key, entry);
  }
  entry.count++;
  if (now - entry.lastLoggedAt < LOG_THROTTLE_MS) return;
  const suppressed = entry.count - 1;
  entry.lastLoggedAt = now;
  entry.count = 0;
  console.warn(`[collab] ${message}${suppressed > 0 ? ` (+${suppressed} suppressed)` : ""}`);
}

function safeSend(ws: WebSocket, payload: Record<string, unknown>): void {
  if (ws.readyState !== ws.OPEN) return;
  ws.send(JSON.stringify(payload));
}

/**
 * Send an already-serialised frame. Lets a broadcast stringify once for the
 * whole room instead of once per recipient.
 */
function sendRawFrame(ws: WebSocket, data: string, options: { lossy?: boolean } = {}): void {
  if (ws.readyState !== ws.OPEN) return;
  // Backpressure: a client that cannot drain must not grow the server's heap
  // without bound. Cursor traffic is superseded by the next frame anyway, so
  // drop it rather than queue it; state-bearing frames are always queued.
  if (options.lossy && ws.bufferedAmount > MAX_BUFFERED_BYTES) {
    logThrottled("slow_client", `dropping lossy frame for slow client (${ws.bufferedAmount}B buffered)`);
    return;
  }
  ws.send(data);
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

  // Cancel any pending cursor flush so a closed room leaves no live timer
  if (room.cursorTimer) {
    clearTimeout(room.cursorTimer);
    room.cursorTimer = null;
  }
  room.pendingCursors.clear();

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
  options: { exceptClientId?: string; lossy?: boolean } = {},
): void {
  const { exceptClientId, lossy } = options;

  // Serialise once for the whole room. Doing it per recipient meant a 15-seat
  // room paid 14 JSON.stringify calls for one identical frame — with
  // whole-collection patches that was the relay's dominant cost.
  const data = JSON.stringify(payload);

  if (
    exceptClientId !== room.hostUser.id &&
    room.hostWs &&
    room.hostWs.readyState === room.hostWs.OPEN
  ) {
    sendRawFrame(room.hostWs, data, { lossy });
  }

  for (const [clientId, guest] of room.guests.entries()) {
    if (clientId === exceptClientId) continue;
    sendRawFrame(guest.ws, data, { lossy });
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

/**
 * Apply a patch to a room snapshot.
 *
 * Patches are sparse and per entity. The merge rule is structural rather than
 * a hard-coded list of collection names, so adding a collection to the domain
 * needs no change here:
 *
 *   - an object value is an entity collection → merge one level, and a `null`
 *     entry is a tombstone that removes that entity
 *   - anything else is a scalar → assign
 *
 * The invariant this relies on: every object-valued key at the top level of a
 * patch is a keyed collection of entities. Whole-state transfers do not come
 * through here — they go via the snapshot path (host:join / session:init /
 * SYNC_SNAPSHOT), which replaces outright.
 */
function applyPatch(snapshot: Record<string, unknown>, patch: Record<string, unknown>): void {
  for (const [key, value] of Object.entries(patch)) {
    if (!isRecord(value)) {
      snapshot[key] = value;
      continue;
    }

    const existing = snapshot[key];
    const target: Record<string, unknown> = isRecord(existing) ? { ...existing } : {};

    for (const [entityId, entityValue] of Object.entries(value)) {
      if (entityValue === null) {
        delete target[entityId];
      } else {
        target[entityId] = entityValue;
      }
    }

    snapshot[key] = target;
  }
}

function handleHostJoin(ws: WebSocket, message: JsonMessage): void {
  if (hasProtocolMismatch(ws, message)) return;

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
    operationLogBytes: 0,
    pendingCursors: new Map(),
    cursorTimer: null,
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
  if (hasProtocolMismatch(ws, message)) return;

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
    sendError(ws, "room_full", `Room is full (maximum ${MAX_PARTICIPANTS} participants)`, { close: true });
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
    protocol: COLLAB_PROTOCOL_VERSION,
    // The server may rename a colliding guest id (see ensureUniqueGuestId), so
    // tell the client which id it was actually assigned. Coalesced cursor
    // frames include the recipient's own entry, and this is what it filters on.
    clientId,
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
 * Append an operation to the room's replay log, evicting the oldest entries
 * until it is within both the count and byte budgets. Oldest-first eviction
 * keeps the most recent history, which is what a resync actually replays.
 */
function appendOperation(room: Room, op: Room["operationLog"][number]): void {
  room.operationLog.push(op);
  room.operationLogBytes += op.bytes;

  while (
    room.operationLog.length > MAX_OPERATION_LOG_SIZE ||
    (room.operationLogBytes > MAX_OPERATION_LOG_BYTES && room.operationLog.length > 1)
  ) {
    const evicted = room.operationLog.shift();
    if (!evicted) break;
    room.operationLogBytes -= evicted.bytes;
  }
  if (room.operationLogBytes < 0) room.operationLogBytes = 0;
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
  if (isRateLimited(rateKeyFor(roomId, state.clientId))) {
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
  // Under LWW-per-collection, the gate provides no safety: every patch overwrites
  // the entire collection anyway, so no patch is "safe" vs "unsafe" to apply.
  // A real gap policy depends on the per-operation protocol (see docs/collab-architecture-study.md).
  const hasVersionGap = clientVersion !== null && clientVersion < room.version - 1;

  // Generate operation ID if not provided by client
  const operationId = clientOperationId ?? crypto.randomUUID();

  // Increment version and apply patch
  room.version++;
  applyPatch(room.snapshot, patch);

  appendOperation(room, {
    version: room.version,
    operationId,
    clientId: state.clientId,
    patch,
    timestamp: Date.now(),
    bytes: frameSizes.get(message) ?? 0,
  });

  // Check if we need to take a periodic snapshot
  checkAndTakePeriodicSnapshot(room, roomId);

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
  // Warn client about version gap AFTER applying (non-blocking)
  if (hasVersionGap) {
    safeSend(ws, {
      type: "SYNC_REQUIRED",
      currentVersion: room.version,
      reason: "VERSION_GAP",
    });
  }
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
  if (isRateLimited(rateKeyFor(roomId, state.clientId))) {
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
  // Under LWW-per-collection, the gate provides no safety: every patch overwrites
  // the entire collection anyway, so no patch is "safe" vs "unsafe" to apply.
  // A real gap policy depends on the per-operation protocol (see docs/collab-architecture-study.md).
  const hasVersionGap = clientVersion !== null && clientVersion < room.version - 1;

  // Generate operation ID if not provided by client
  const operationId = clientOperationId ?? crypto.randomUUID();

  // Increment version and apply patch
  room.version++;
  applyPatch(room.snapshot, patch);

  appendOperation(room, {
    version: room.version,
    operationId,
    clientId: state.clientId,
    patch,
    timestamp: Date.now(),
    bytes: frameSizes.get(message) ?? 0,
  });

  // Check if we need to take a periodic snapshot
  checkAndTakePeriodicSnapshot(room, roomId);

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

  // Warn client about version gap AFTER applying (non-blocking)
  if (hasVersionGap) {
    safeSend(ws, {
      type: "SYNC_REQUIRED",
      currentVersion: room.version,
      reason: "VERSION_GAP",
    });
  }
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

  // Coalesce rather than relay. Relaying each cursor immediately cost one send
  // per peer per event: a full room at 30Hz was 6,300 sends/s from one room
  // alone. Keeping only the newest position per client and flushing the room
  // once per tick makes that 15 sends per tick regardless of how fast anyone
  // moves, which is what lets 50 rooms share one event loop.
  room.pendingCursors.set(state.clientId, { clientId: state.clientId, user, cursor, activeElementId });
  scheduleCursorFlush(room, roomId);
}

/**
 * Flush the room's coalesced cursor positions as a single frame.
 *
 * The frame carries every pending cursor, including the recipient's own, so
 * the room pays one JSON.stringify instead of one per recipient. Clients drop
 * their own entry by clientId.
 */
function flushCursors(room: Room, roomId: string): void {
  room.cursorTimer = null;
  if (room.pendingCursors.size === 0) return;

  const cursors = Array.from(room.pendingCursors.values());
  room.pendingCursors.clear();

  broadcastToRoom(room, { type: "peer:cursors", roomId, cursors }, { lossy: true });
}

function scheduleCursorFlush(room: Room, roomId: string): void {
  if (room.cursorTimer) return;
  room.cursorTimer = setTimeout(() => {
    flushCursors(room, roomId);
  }, CURSOR_FLUSH_MS);
}

/**
 * Check if periodic snapshot is needed and take it if so.
 * Called after each operation.
 */
function checkAndTakePeriodicSnapshot(room: Room, roomId: string): void {
  // Check if we've accumulated enough operations since last snapshot
  const opsSinceSnapshot = room.version - room.snapshotAtVersion;

  if (opsSinceSnapshot >= SNAPSHOT_INTERVAL_OPS) {
    takePeriodicSnapshot(room, roomId);
  }
}

/**
 * Take a periodic snapshot and broadcast it to all clients.
 * This resets the operation log and updates snapshotAtVersion.
 */
function takePeriodicSnapshot(room: Room, roomId: string): void {
  const snapshotVersion = room.version;

  // Broadcast snapshot to all clients
  broadcastToRoom(room, {
    type: "PERIODIC_SNAPSHOT",
    version: snapshotVersion,
    snapshot: { ...room.snapshot },
  });

  // Capture old snapshot version BEFORE updating so the filter keeps the right ops
  const previousSnapshotAtVersion = room.snapshotAtVersion;

  // Update snapshot marker
  room.snapshotAtVersion = snapshotVersion;

  // Trim operation log to only keep ops newer than the previous snapshot
  // This keeps memory bounded while allowing resync
  const opsToKeep = room.operationLog.filter((op) => op.version > previousSnapshotAtVersion);
  room.operationLog = opsToKeep;
  // Keep the byte counter in step with the log it tracks.
  room.operationLogBytes = opsToKeep.reduce((total, op) => total + op.bytes, 0);

  console.log(
    `[collab] periodic snapshot: room=${roomId}, version=${snapshotVersion}, opsLogged=${room.operationLog.length}`,
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
      takePeriodicSnapshot(room, roomId);
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
  clearRateLimitData(rateKeyFor(state.roomId, state.clientId));
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

  room.pendingCursors.delete(state.clientId);

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
