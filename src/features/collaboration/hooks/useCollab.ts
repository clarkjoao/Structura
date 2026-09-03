import { useCallback, useEffect, useRef } from "react";
import type { CollabSession, CollabStatus, CollabUser, PeerState } from "../types";
import { randomColor } from "../utils/collab-colors";
import { readPrefs } from "../utils/collab-preferences";
import { useCollabStore } from "../store/collab.store";

export interface CollabSnapshot {
  diagramId: string;
  diagramName: string;
  level: string;
  domain?: string;
  description?: string;
  components: Record<string, unknown>;
  connections: Record<string, unknown>;
  flows: Record<string, unknown>;
  nodeLayouts: Record<string, unknown>;
  edgeLayouts: Record<string, unknown>;
  iconLibrary: Record<string, unknown>;
  scenes: Record<string, unknown>;
  activeSceneId: string | null;
  compareSceneId: string | null;
}

export type CollabPatch = Partial<Omit<CollabSnapshot, "diagramId">>;

export interface UseCollabParams {
  diagramId: string | null;

  activeDiagramId?: string | null;
  isHost: boolean;
  userName: string;
  serverUrl: string;

  getSnapshot: () => CollabSnapshot | null;

  onSnapshot: (snapshot: CollabSnapshot) => void;

  onPatch: (patch: CollabPatch) => void;
}

export interface UseCollabReturn {
  session: CollabSession | null;
  status: CollabStatus;
  isReady: boolean;
  sessionClosedByHost: boolean;
  hostDisconnected: boolean;
  roomFullReason: string | null;
  participantCount: number;
  maxParticipants: number;
  sendPatch: (patch: CollabPatch) => void;
  sendCursor: (cursor: { x: number; y: number } | null) => void;
  setActiveElement: (elementId: string | null) => void;
  closeSession: () => void;
}

const RECONNECT_DELAYS_MS = [2000, 4000, 8000, 15000, 30000];
const ROOM_NOT_FOUND_RETRY_MS = 3000;
const CLIENT_PING_INTERVAL_MS = 25_000;
const CLIENT_PONG_TIMEOUT_MS = 10_000;
const MAX_PENDING_OPS = 100; // Max pending operations before forcing resync

/**
 * Wire protocol version, sent on join and validated by the server.
 *
 * v2 made patches sparse and per entity. The change is silent on the wire —
 * the keys are identical — so a v1 client reading a v2 patch would treat
 * "these entities changed" as "the collection is now only these entities" and
 * wipe the diagram on screen. The handshake exists to make that impossible.
 */
export const COLLAB_PROTOCOL_VERSION = 2;

// Coalescing and batching configuration
const BATCH_INTERVAL_MS = 50; // Send batched patches every 50ms
const MAX_BATCH_SIZE = 10; // Max patches per batch

interface PendingOperation {
  id: string;
  timestamp: number;
  patch: CollabPatch;
}

// Version tracking for sequencing
interface LocalVersion {
  version: number;
  baseVersion: number; // Version when we last synced with server
}

// Batching for optimized network usage
interface BatchedPatch {
  patch: CollabPatch;
  timestamp: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

interface ParsedPeerCursor {
  clientId: string;
  user: { id: string; name: string; color: string };
  cursor: { x: number; y: number } | null;
  activeElementId: string | null;
}

/**
 * Parse one cursor entry. Shared by the single `peer:cursor` frame and the
 * coalesced `peer:cursors` batch, which carry identical entry shapes.
 */
function parsePeerCursorEntry(source: Record<string, unknown>): ParsedPeerCursor | null {
  const clientId = typeof source.clientId === "string" ? source.clientId : null;
  const userRaw = source.user;
  const user = isRecord(userRaw)
    ? {
        id: typeof userRaw.id === "string" ? userRaw.id : "",
        name: typeof userRaw.name === "string" ? userRaw.name : "",
        color: typeof userRaw.color === "string" ? userRaw.color : "#6366f1",
      }
    : null;

  if (!clientId || !user?.id || !user.name) return null;

  const cursorValue = source.cursor;
  const cursor =
    cursorValue === null
      ? null
      : isRecord(cursorValue) &&
          typeof cursorValue.x === "number" &&
          typeof cursorValue.y === "number"
        ? { x: cursorValue.x, y: cursorValue.y }
        : null;
  const activeElementId: string | null =
    typeof source.activeElementId === "string" || source.activeElementId === null
      ? (source.activeElementId as string | null)
      : null;

  return { clientId, user, cursor, activeElementId };
}


function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function parsePeers(value: unknown): PeerState[] {
  if (!Array.isArray(value)) return [];

  const peers: PeerState[] = [];
  for (const item of value) {
    if (!isRecord(item)) continue;
    const clientId = typeof item.clientId === "string" ? item.clientId : null;
    const userValue = isRecord(item.user) ? item.user : null;
    const user: CollabUser | null =
      userValue &&
      typeof userValue.id === "string" &&
      typeof userValue.name === "string" &&
      typeof userValue.color === "string"
        ? {
            id: userValue.id,
            name: userValue.name,
            color: userValue.color,
          }
        : null;

    if (!clientId || !user) continue;

    peers.push({
      clientId,
      user,
      cursor: null,
      activeElementId: null,
    });
  }
  return peers;
}

function parseSnapshot(value: unknown): CollabSnapshot | null {
  if (!isRecord(value)) return null;
  const diagramId = value.diagramId;
  const diagramName = value.diagramName;
  const level = value.level;
  if (typeof diagramId !== "string") return null;
  if (typeof diagramName !== "string") return null;
  if (typeof level !== "string") return null;

  const activeSceneId: string | null =
    typeof value.activeSceneId === "string" || value.activeSceneId === null
      ? (value.activeSceneId as string | null)
      : null;
  const compareSceneId: string | null =
    typeof value.compareSceneId === "string" || value.compareSceneId === null
      ? (value.compareSceneId as string | null)
      : null;

  return {
    diagramId,
    diagramName,
    level,
    domain: typeof value.domain === "string" ? value.domain : undefined,
    description: typeof value.description === "string" ? value.description : undefined,
    components: isRecord(value.components) ? value.components : {},
    connections: isRecord(value.connections) ? value.connections : {},
    flows: isRecord(value.flows) ? value.flows : {},
    nodeLayouts: isRecord(value.nodeLayouts) ? value.nodeLayouts : {},
    edgeLayouts: isRecord(value.edgeLayouts) ? value.edgeLayouts : {},
    iconLibrary: isRecord(value.iconLibrary) ? value.iconLibrary : {},
    scenes: isRecord(value.scenes) ? value.scenes : {},
    activeSceneId,
    compareSceneId,
  };
}

export function useCollab({
  diagramId,
  activeDiagramId = null,
  isHost,
  userName,
  serverUrl,
  getSnapshot,
  onSnapshot,
  onPatch,
}: UseCollabParams): UseCollabReturn {
  const roomId = diagramId ?? null;

  const initialName = userName.trim() || readPrefs().userName.trim() || "User";
  const localUserRef = useRef<CollabUser>({
    id: randomId(),
    name: initialName,
    color: randomColor(),
  });

  const getSnapshotRef = useRef(getSnapshot);
  const onSnapshotRef = useRef(onSnapshot);
  const onPatchRef = useRef(onPatch);

  const wsRef = useRef<WebSocket | null>(null);
  const retryAttemptRef = useRef(0);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pongTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shouldReconnectRef = useRef(true);
  const intentionalCloseRef = useRef(false);
  const isUnmountedRef = useRef(false);
  const roomNotFoundRetryRef = useRef(false);
  const activeElementIdRef = useRef<string | null>(null);
  // Id the server assigned us. Usually our own user id, but the server renames
  // colliding guest ids, and coalesced cursor frames are filtered against this.
  const assignedClientIdRef = useRef<string | null>(null);
  const lastCursorRef = useRef<{ x: number; y: number } | null>(null);

  // Operation tracking for ACK mechanism
  const pendingOpsRef = useRef<Map<string, PendingOperation>>(new Map());

  // Version tracking
  const versionRef = useRef<LocalVersion>({ version: 0, baseVersion: 0 });

  // Batching for coalescing operations
  const pendingBatchRef = useRef<BatchedPatch[]>([]);
  const batchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Stores the last batch sent so it can be re-enqueued on server rejection (rate_limited / batch_too_large)
  const sentBatchDataRef = useRef<BatchedPatch[]>([]);
  // Tracks whether we are in a rate-limit backoff window
  const rateLimitedRetryRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const RATE_LIMITED_BACKOFF_MS = 500;

  const session = useCollabStore((state) => state.session);
  const status = useCollabStore((state) => state.status);
  const isReady = useCollabStore((state) => state.isReady);
  const sessionClosedByHost = useCollabStore((state) => state.sessionClosedByHost);
  const hostDisconnected = useCollabStore((state) => state.hostDisconnected);
  const roomFullReason = useCollabStore((state) => state.roomFullReason);
  const participantCount = useCollabStore((state) => state.participantCount);
  const maxParticipants = useCollabStore((state) => state.maxParticipants);

  getSnapshotRef.current = getSnapshot;
  onSnapshotRef.current = onSnapshot;
  onPatchRef.current = onPatch;

  const clearReconnectTimer = useCallback(() => {
    if (!reconnectTimerRef.current) return;
    clearTimeout(reconnectTimerRef.current);
    reconnectTimerRef.current = null;
  }, []);

  const clearClientHeartbeat = useCallback(() => {
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current);
      pingIntervalRef.current = null;
    }
    if (pongTimeoutRef.current) {
      clearTimeout(pongTimeoutRef.current);
      pongTimeoutRef.current = null;
    }
  }, []);

  const sendRaw = useCallback((payload: Record<string, unknown>) => {
    const ws = wsRef.current;
    if (!ws || ws.readyState !== WebSocket.OPEN) return;
    ws.send(JSON.stringify(payload));
  }, []);

  const connect = useCallback(() => {
    if (!roomId || isUnmountedRef.current) return;

    clearReconnectTimer();
    clearClientHeartbeat();

    const ws = new WebSocket(serverUrl);
    wsRef.current = ws;

    const connectingStatus: CollabStatus =
      retryAttemptRef.current === 0 ? "connecting" : "reconnecting";
    const collabStore = useCollabStore.getState();
    collabStore.setIsReady(false);
    collabStore.setSession({
      roomId,
      isHost,
      localUser: localUserRef.current,
      peers: collabStore.session?.peers ?? [],
      status: connectingStatus,
    });

    const startClientHeartbeat = () => {
      clearClientHeartbeat();
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState !== WebSocket.OPEN) return;

        ws.send(JSON.stringify({ type: "ping" }));

        if (pongTimeoutRef.current) {
          clearTimeout(pongTimeoutRef.current);
        }

        pongTimeoutRef.current = setTimeout(() => {
          try {
            ws.close();
          } catch (err) {
            console.warn("[useCollab] Failed to close WebSocket on pong timeout:", err);
          }
        }, CLIENT_PONG_TIMEOUT_MS);
      }, CLIENT_PING_INTERVAL_MS);
    };

    ws.onopen = () => {
      startClientHeartbeat();
      useCollabStore.getState().setSessionClosedByHost(false);
      useCollabStore.getState().setHostDisconnected(false);

      if (isHost) {
        const existingSnapshot = getSnapshotRef.current();
        const resolvedDiagramId =
          existingSnapshot?.diagramId ??
          (typeof activeDiagramId === "string" && activeDiagramId.length > 0
            ? activeDiagramId
            : "");
        const snapshot = existingSnapshot ?? {
          diagramId: resolvedDiagramId,
          diagramName: "",
          level: "context",
          components: {},
          connections: {},
          flows: {},
          nodeLayouts: {},
          edgeLayouts: {},
          iconLibrary: {},
          scenes: {},
          activeSceneId: null,
          compareSceneId: null,
        };

        ws.send(
          JSON.stringify({
            type: "host:join",
            protocol: COLLAB_PROTOCOL_VERSION,
            roomId,
            diagramId:
              typeof activeDiagramId === "string" && activeDiagramId.length > 0
                ? activeDiagramId
                : null,
            user: localUserRef.current,
            snapshot,
          }),
        );

        return;
      }

      ws.send(
        JSON.stringify({
          type: "guest:join",
          protocol: COLLAB_PROTOCOL_VERSION,
          roomId,
          user: localUserRef.current,
        }),
      );
    };

    ws.onmessage = (event) => {
      let message: Record<string, unknown> | null = null;
      try {
        const parsed = JSON.parse(String(event.data));
        message = isRecord(parsed) ? parsed : null;
      } catch {
        message = null;
      }

      if (!message) return;

      const messageType = typeof message.type === "string" ? message.type : "";

      switch (messageType) {
        case "host:ack": {
          if (message.resumed === true && isRecord(message.snapshot)) {
            const snapshot = parseSnapshot(message.snapshot as Record<string, unknown>);
            if (snapshot) {
              onSnapshotRef.current(snapshot);
            }
            // Extract version from server
            const msgVersion = typeof message.version === "number" ? message.version : 0;
            versionRef.current.version = msgVersion;
            versionRef.current.baseVersion = msgVersion;
          }
          if (isHost) {
            const store = useCollabStore.getState();
            store.setIsReady(true);
            store.setSession({
              roomId,
              isHost,
              localUser: localUserRef.current,
              peers: [],
              status: "connected",
            });
          }
          return;
        }
        case "host:reconnecting": {
          const storeReconnecting = useCollabStore.getState();
          storeReconnecting.setStatus("reconnecting");
          storeReconnecting.setIsReady(false);
          return;
        }
        case "host:reconnected": {
          const storeReconnected = useCollabStore.getState();
          storeReconnected.setStatus("connected");
          storeReconnected.setIsReady(true);
          return;
        }
        case "session:init": {
          const snapshot = parseSnapshot(message.snapshot);
          if (!snapshot) return;

          onSnapshotRef.current(snapshot);

          const peers = parsePeers(message.peers);

          // Extract version from server
          const msgVersion = typeof message.version === "number" ? message.version : 0;
          versionRef.current.version = msgVersion;
          versionRef.current.baseVersion = msgVersion;

          // Extract participant count from server
          if (typeof message.clientId === "string") {
            assignedClientIdRef.current = message.clientId;
          }

          const msgParticipantCount = typeof message.participantCount === "number" ? message.participantCount : 1;
          const msgMaxParticipants = typeof message.maxParticipants === "number" ? message.maxParticipants : 15;

          useCollabStore.getState().setParticipantCount(msgParticipantCount, msgMaxParticipants);
          useCollabStore.getState().setIsReady(true);
          retryAttemptRef.current = 0;
          useCollabStore.getState().setSession({
            roomId,
            isHost,
            localUser: localUserRef.current,
            peers,
            status: "connected",
          });
          return;
        }
        case "session:patch": {
          const patch = isRecord(message.patch) ? (message.patch as CollabPatch) : null;
          if (!patch) return;

          // Track the operation ID if present (from server broadcast)
          const operationId = typeof message.operationId === "string" ? message.operationId : null;
          const clientId = typeof message.clientId === "string" ? message.clientId : null;
          const serverVersion = typeof message.version === "number" ? message.version : null;

          // Update local version if server provides one
          if (serverVersion !== null && serverVersion > versionRef.current.version) {
            versionRef.current.version = serverVersion;
          }

          // Mark as acknowledged if we sent this operation
          if (operationId) {
            pendingOpsRef.current.delete(operationId);
          }

          onPatchRef.current(patch);
          return;
        }
        case "OP_ACK": {
          const operationId = typeof message.operationId === "string" ? message.operationId : null;
          const accepted = message.accepted === true;
          const serverVersion = typeof message.version === "number" ? message.version : null;

          // Update local version if provided
          if (serverVersion !== null && serverVersion > versionRef.current.version) {
            versionRef.current.version = serverVersion;
          }

          if (operationId) {
            if (accepted) {
              pendingOpsRef.current.delete(operationId);
              // Batch was accepted — clear the stored sent-batch so re-enqueue won't fire
              sentBatchDataRef.current = [];
            } else {
              // Operation was rejected - remove from pending
              pendingOpsRef.current.delete(operationId);
              const reason = typeof message.reason === "string" ? message.reason : "unknown";
              console.warn(`[useCollab] operation rejected: id=${operationId}, reason=${reason}`);
            }
          }
          return;
        }
        case "SYNC_REQUIRED": {
          const currentVersion = typeof message.currentVersion === "number" ? message.currentVersion : null;
          const reason = typeof message.reason === "string" ? message.reason : "unknown";

          console.log(`[useCollab] sync required: version=${currentVersion}, reason=${reason}`);

          if (currentVersion !== null) {
            // Request sync from server
            sendRaw({
              type: "sync:request",
              roomId,
              baseVersion: versionRef.current.baseVersion,
            });
          }
          return;
        }
        case "SYNC_COMPLETE": {
          const newVersion = typeof message.version === "number" ? message.version : null;
          const operations = Array.isArray(message.operations) ? message.operations : [];

          if (newVersion !== null) {
            versionRef.current.version = newVersion;
            versionRef.current.baseVersion = newVersion;
          }

          // Apply all operations in order
          for (const op of operations) {
            if (isRecord(op) && isRecord(op.patch)) {
              onPatchRef.current(op.patch as CollabPatch);
            }
          }

          console.log(`[useCollab] sync complete: version=${newVersion}, ops=${operations.length}`);
          return;
        }
        case "SYNC_SNAPSHOT": {
          const newVersion = typeof message.version === "number" ? message.version : null;

          if (newVersion !== null) {
            versionRef.current.version = newVersion;
            versionRef.current.baseVersion = newVersion;
          }

          // Full snapshot received, apply it
          const snapshot = parseSnapshot(message.snapshot);
          if (snapshot) {
            onSnapshotRef.current(snapshot);
          }

          console.log(`[useCollab] sync snapshot: version=${newVersion}`);
          return;
        }
        case "PERIODIC_SNAPSHOT": {
          const newVersion = typeof message.version === "number" ? message.version : null;

          if (newVersion !== null) {
            versionRef.current.version = newVersion;
            // baseVersion is NOT updated here - we keep tracking from where we were
          }

          // Full snapshot received, apply it to reset state
          const snapshot = parseSnapshot(message.snapshot);
          if (snapshot) {
            onSnapshotRef.current(snapshot);
          }

          console.log(`[useCollab] periodic snapshot: version=${newVersion}`);
          return;
        }
        case "peer:joined": {
          const clientId = typeof message.clientId === "string" ? message.clientId : null;
          const userRaw = message.user;
          const user = isRecord(userRaw)
            ? {
                id: typeof userRaw.id === "string" ? userRaw.id : "",
                name: typeof userRaw.name === "string" ? userRaw.name : "",
                color: typeof userRaw.color === "string" ? userRaw.color : "#6366f1",
              }
            : null;

          if (!clientId || !user?.id || !user.name) return;
          useCollabStore.getState().upsertPeer({
            clientId,
            user,
            cursor: null,
            activeElementId: null,
          });

          // Update participant count if provided
          if (typeof message.participantCount === "number" && typeof message.maxParticipants === "number") {
            useCollabStore.getState().setParticipantCount(message.participantCount, message.maxParticipants);
          }
          return;
        }
        case "peer:left": {
          const clientId = typeof message.clientId === "string" ? message.clientId : null;
          if (!clientId) return;
          useCollabStore.getState().removePeer(clientId);

          // Update participant count if provided
          if (typeof message.participantCount === "number" && typeof message.maxParticipants === "number") {
            useCollabStore.getState().setParticipantCount(message.participantCount, message.maxParticipants);
          }
          return;
        }
        // Coalesced cursor frame: the server batches a room's cursors into one
        // message per tick. It includes our own entry (so the room serialises
        // once instead of once per recipient), which we skip here.
        case "peer:cursors": {
          const entries = Array.isArray(message.cursors) ? message.cursors : [];
          const selfId = assignedClientIdRef.current ?? localUserRef.current.id;
          for (const entry of entries) {
            if (!isRecord(entry)) continue;
            const parsed = parsePeerCursorEntry(entry);
            if (!parsed || parsed.clientId === selfId) continue;
            useCollabStore.getState().applyPeerCursorPayload({
              ...parsed,
              preserveCursorIfMessageNull: true,
            });
          }
          return;
        }
        case "peer:cursor": {
          const parsed = parsePeerCursorEntry(message);
          if (!parsed) return;

          useCollabStore.getState().applyPeerCursorPayload({
            ...parsed,
            preserveCursorIfMessageNull: true,
          });
          return;
        }
        case "session:closed": {
          shouldReconnectRef.current = false;
          intentionalCloseRef.current = true;
          const storeClosed = useCollabStore.getState();
          storeClosed.setSessionClosedByHost(true);
          storeClosed.setStatus("closed");
          storeClosed.setIsReady(false);
          clearClientHeartbeat();
          try {
            ws.close(1000);
          } catch (err) {
            console.warn("[useCollab] Failed to close WebSocket on session:closed:", err);
          }
          return;
        }
        case "host:disconnected": {
          shouldReconnectRef.current = false;
          intentionalCloseRef.current = true;
          const storeHostDisc = useCollabStore.getState();
          storeHostDisc.setHostDisconnected(true);
          storeHostDisc.setStatus("closed");
          storeHostDisc.setIsReady(false);
          clearClientHeartbeat();
          try {
            ws.close(1000);
          } catch (err) {
            console.warn("[useCollab] Failed to close WebSocket on host:disconnected:", err);
          }
          return;
        }
        case "error": {
          const code = typeof message.code === "string" ? message.code : "";
          const errorMessage = typeof message.message === "string" ? message.message : "";

          if (code === "room_not_found" && !isHost) {
            roomNotFoundRetryRef.current = true;
            try {
              ws.close(4004, "room_not_found");
            } catch (err) {
              console.warn("[useCollab] Failed to close WebSocket on room_not_found:", err);
            }
            return;
          }

          if (code === "room_full") {
            shouldReconnectRef.current = false;
            intentionalCloseRef.current = true;
            useCollabStore.getState().setRoomFullReason(errorMessage || `Room is full (maximum 15 participants)`);
            useCollabStore.getState().setStatus("disconnected");
            useCollabStore.getState().setIsReady(false);
            clearClientHeartbeat();
            try {
              ws.close(1008, "room_full");
            } catch (err) {
              console.warn("[useCollab] Failed to close WebSocket on room_full:", err);
            }
          }

          // Re-enqueue the batch if the server rejected it due to rate limiting or batch size.
          // The patches are preserved in sentBatchDataRef and re-enqueued one at a time after a backoff.
          if ((code === "rate_limited" || code === "batch_too_large") && sentBatchDataRef.current.length > 0) {
            const patchesToRequeue = sentBatchDataRef.current;
            sentBatchDataRef.current = [];
            // Cancel any pending batch timer since we are taking over
            if (batchTimerRef.current) {
              clearTimeout(batchTimerRef.current);
              batchTimerRef.current = null;
            }
            // Schedule each patch individually with backoff
            if (rateLimitedRetryRef.current) {
              clearTimeout(rateLimitedRetryRef.current);
            }
            rateLimitedRetryRef.current = setTimeout(() => {
              rateLimitedRetryRef.current = null;
              for (const item of patchesToRequeue) {
                pendingBatchRef.current.push(item);
                if (pendingBatchRef.current.length >= MAX_BATCH_SIZE) {
                  flushBatch();
                }
              }
              // If we didn't fill a batch, schedule the normal timer
              if (pendingBatchRef.current.length > 0 && !batchTimerRef.current) {
                batchTimerRef.current = setTimeout(() => {
                  flushBatch();
                  batchTimerRef.current = null;
                }, BATCH_INTERVAL_MS);
              }
            }, RATE_LIMITED_BACKOFF_MS);
          }
          return;
        }
        case "ping": {
          ws.send(JSON.stringify({ type: "pong" }));
          return;
        }
        case "pong": {
          if (pongTimeoutRef.current) {
            clearTimeout(pongTimeoutRef.current);
            pongTimeoutRef.current = null;
          }
          return;
        }
        default:
          return;
      }
    };

    ws.onclose = () => {
      clearClientHeartbeat();

      // Clear pending operations, version, and batch on disconnect
      pendingOpsRef.current.clear();
      assignedClientIdRef.current = null;
      versionRef.current = { version: 0, baseVersion: 0 };

      // Clear batch timer and flush
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
      pendingBatchRef.current = [];
      sentBatchDataRef.current = [];
      if (rateLimitedRetryRef.current) {
        clearTimeout(rateLimitedRetryRef.current);
        rateLimitedRetryRef.current = null;
      }

      if (wsRef.current === ws) {
        wsRef.current = null;
      }

      if (isUnmountedRef.current || intentionalCloseRef.current || !shouldReconnectRef.current) {
        return;
      }

      if (roomNotFoundRetryRef.current) {
        roomNotFoundRetryRef.current = false;
        reconnectTimerRef.current = setTimeout(() => {
          if (isUnmountedRef.current) return;
          connect();
        }, ROOM_NOT_FOUND_RETRY_MS);
        return;
      }

      if (retryAttemptRef.current >= RECONNECT_DELAYS_MS.length) {
        const storeGiveUp = useCollabStore.getState();
        storeGiveUp.setStatus("disconnected");
        storeGiveUp.setIsReady(false);
        return;
      }

      const delay = RECONNECT_DELAYS_MS[retryAttemptRef.current];
      retryAttemptRef.current += 1;
      const storeRetry = useCollabStore.getState();
      storeRetry.setStatus("reconnecting");
      storeRetry.setIsReady(false);

      reconnectTimerRef.current = setTimeout(() => {
        if (isUnmountedRef.current) return;
        connect();
      }, delay);
    };

    ws.onerror = () => {};
  }, [activeDiagramId, clearClientHeartbeat, clearReconnectTimer, isHost, roomId, serverUrl]);

  useEffect(() => {
    if (!roomId) {
      const storeReset = useCollabStore.getState();
      storeReset.setSession(null);
      storeReset.setStatus("idle");
      storeReset.setIsReady(false);
      return;
    }

    isUnmountedRef.current = false;
    intentionalCloseRef.current = false;
    shouldReconnectRef.current = true;
    roomNotFoundRetryRef.current = false;
    retryAttemptRef.current = 0;
    const storeStart = useCollabStore.getState();
    storeStart.setSessionClosedByHost(false);
    storeStart.setHostDisconnected(false);

    connect();

    return () => {
      isUnmountedRef.current = true;
      intentionalCloseRef.current = true;
      shouldReconnectRef.current = false;
      clearReconnectTimer();
      clearClientHeartbeat();

      // Clear batch timer
      if (batchTimerRef.current) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
      }
      // Flush any remaining batched patches
      if (pendingBatchRef.current.length > 0) {
        flushBatch();
      }

      const ws = wsRef.current;
      wsRef.current = null;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        try {
          if (isHost && roomId) {
            ws.send(JSON.stringify({ type: "host:close", roomId }));
          }
          ws.close(1000, "unmount");
        } catch (err) {
          console.warn("[useCollab] Failed to close WebSocket on unmount:", err);
        }
      }
    };
  }, [clearClientHeartbeat, clearReconnectTimer, connect, isHost, roomId]);

  // flushBatch must be declared before sendPatch so it captures the current isHost/sendRaw
  const flushBatch = useCallback(() => {
    if (pendingBatchRef.current.length === 0) return;
    if (!roomId) return;

    const type = isHost ? "host:patch" : "guest:patch";
    const batch = pendingBatchRef.current;
    pendingBatchRef.current = [];
    // Store for potential re-enqueue if server rejects with rate_limited / batch_too_large
    sentBatchDataRef.current = batch;

    // Generate one operationId for the (potentially merged) batch
    const operationId = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `op-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

    // Register one pending op for the batch (not one per item)
    pendingOpsRef.current.set(operationId, {
      id: operationId,
      timestamp: Date.now(),
      patch: {}, // Patch object itself is not needed for tracking
    });

    // Limit pending operations to prevent memory leaks
    if (pendingOpsRef.current.size > MAX_PENDING_OPS) {
      console.warn(`[useCollab] too many pending ops (${pendingOpsRef.current.size}), clearing oldest`);
      const oldestKey = pendingOpsRef.current.keys().next().value;
      if (oldestKey) {
        pendingOpsRef.current.delete(oldestKey);
      }
    }

    if (batch.length === 1) {
      // Single patch - send directly
      const item = batch[0];
      sendRaw({
        type,
        roomId,
        patch: item.patch,
        operationId,
        version: versionRef.current.version,
      });
    } else {
      // Multiple patches - merge into single payload
      // Note: We use last-write-wins strategy for same keys
      const mergedPatch: CollabPatch = {};
      for (const item of batch) {
        Object.assign(mergedPatch, item.patch);
      }

      sendRaw({
        type,
        roomId,
        patch: mergedPatch,
        operationId,
        version: versionRef.current.version,
        batched: batch.length,
      });
    }
  }, [roomId, isHost, sendRaw]);

  const sendPatch = useCallback(
    (patch: CollabPatch) => {
      if (!roomId) return;

      // Add to batch queue (no operationId here — generated at flush time)
      pendingBatchRef.current.push({
        patch,
        timestamp: Date.now(),
      });

      // Schedule batch flush
      if (!batchTimerRef.current) {
        batchTimerRef.current = setTimeout(() => {
          flushBatch();
          batchTimerRef.current = null;
        }, BATCH_INTERVAL_MS);
      }

      // Force immediate send if batch is too large
      if (pendingBatchRef.current.length >= MAX_BATCH_SIZE) {
        clearTimeout(batchTimerRef.current);
        batchTimerRef.current = null;
        flushBatch();
      }
    },
    [roomId, flushBatch],
  );

  const sendCursor = useCallback(
    (cursor: { x: number; y: number } | null) => {
      if (!roomId) return;
      if (cursor) lastCursorRef.current = cursor;
      sendRaw({
        type: "peer:cursor",
        roomId,
        cursor,
        activeElementId: activeElementIdRef.current,
      });
    },
    [roomId, sendRaw],
  );

  const sendActiveElement = useCallback(
    (elementId: string | null) => {
      if (!roomId) return;
      sendRaw({
        type: "peer:cursor",
        roomId,
        cursor: lastCursorRef.current,
        activeElementId: elementId,
      });
    },
    [roomId, sendRaw],
  );

  const setActiveElement = useCallback(
    (elementId: string | null) => {
      // Pointer-move handlers call this on every event, but only the
      // transitions carry information. Without this guard each mousemove put a
      // peer:cursor frame on the wire — unthrottled and unbatched — which the
      // server then fanned out to every peer in the room.
      if (activeElementIdRef.current === elementId) return;
      activeElementIdRef.current = elementId;
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        sendActiveElement(elementId);
      }
    },
    [sendActiveElement],
  );

  const closeSession = useCallback(() => {
    if (!roomId || !isHost) return;

    shouldReconnectRef.current = false;
    intentionalCloseRef.current = true;
    sendRaw({ type: "host:close", roomId });

    // Clear pending operations, version, and batch
    pendingOpsRef.current.clear();
    versionRef.current = { version: 0, baseVersion: 0 };

    if (batchTimerRef.current) {
      clearTimeout(batchTimerRef.current);
      batchTimerRef.current = null;
    }
    pendingBatchRef.current = [];
    sentBatchDataRef.current = [];
    if (rateLimitedRetryRef.current) {
      clearTimeout(rateLimitedRetryRef.current);
      rateLimitedRetryRef.current = null;
    }

    const storeClose = useCollabStore.getState();
    storeClose.setStatus("closed");
    storeClose.setIsReady(false);
    storeClose.setSession(null);
    clearClientHeartbeat();

    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      try {
        ws.close(1000);
      } catch (err) {
        console.warn("[useCollab] Failed to close WebSocket on disconnect:", err);
      }
    }
  }, [clearClientHeartbeat, isHost, roomId, sendRaw]);

  return {
    session,
    status,
    isReady,
    sessionClosedByHost,
    hostDisconnected,
    roomFullReason,
    participantCount,
    maxParticipants,
    sendPatch,
    sendCursor,
    setActiveElement,
    closeSession,
  };
}
