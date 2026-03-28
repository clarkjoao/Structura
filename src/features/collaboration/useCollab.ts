import { useCallback, useEffect, useRef, useState } from "react";
import type { CollabSession, CollabStatus, CollabUser, PeerState } from "./types";
import { randomColor } from "./collabColors";
import { readPrefs } from "./collabPreferences";

// ── Snapshot types (opaque wrappers around Zustand diagram state) ─────────────

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
  edgeLayouts: unknown[];
  iconLibrary: Record<string, unknown>;
  scenes: Record<string, unknown>;
  activeSceneId: string | null;
  compareSceneId: string | null;
}

export type CollabPatch = Partial<Omit<CollabSnapshot, "diagramId">>;

// ── Hook params ───────────────────────────────────────────────────────────────

export interface UseCollabParams {
  /** WebSocket room id (ephemeral UUID for host, or UUID from guest invite URL). */
  diagramId: string | null;
  /** Host only: real diagram id for snapshots and server metadata (not the room id). */
  activeDiagramId?: string | null;
  isHost: boolean;
  userName: string;
  serverUrl: string;
  /** Host only: called once on connect to get the full snapshot to send */
  getSnapshot: () => CollabSnapshot | null;
  /** Guest only: called when session:init arrives with the full snapshot */
  onSnapshot: (snapshot: CollabSnapshot) => void;
  /** Guest only: called on every session:patch */
  onPatch: (patch: CollabPatch) => void;
}

export interface UseCollabReturn {
  session: CollabSession | null;
  status: CollabStatus;
  isReady: boolean;
  sessionClosedByHost: boolean;
  hostDisconnected: boolean;
  sendPatch: (patch: CollabPatch) => void;
  sendCursor: (cursor: { x: number; y: number } | null) => void;
  setActiveElement: (elementId: string | null) => void;
  closeSession: () => void;
}

const RECONNECT_DELAYS_MS = [2000, 4000, 8000, 15000, 30000];
const ROOM_NOT_FOUND_RETRY_MS = 3000;
const CLIENT_PING_INTERVAL_MS = 25_000;
const CLIENT_PONG_TIMEOUT_MS = 10_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
    const user: CollabUser | null = userValue &&
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
    edgeLayouts: Array.isArray(value.edgeLayouts) ? value.edgeLayouts : [],
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
  const lastCursorRef = useRef<{ x: number; y: number } | null>(null);

  const [session, setSession] = useState<CollabSession | null>(null);
  const [status, setStatus] = useState<CollabStatus>("idle");
  const [isReady, setIsReady] = useState(false);
  const [sessionClosedByHost, setSessionClosedByHost] = useState(false);
  const [hostDisconnected, setHostDisconnected] = useState(false);

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

  const upsertPeer = useCallback((peer: PeerState) => {
    setSession((previous) => {
      if (!previous) return previous;
      const index = previous.peers.findIndex((existing) => existing.clientId === peer.clientId);
      if (index === -1) {
        return { ...previous, peers: [...previous.peers, peer] };
      }
      const nextPeers = [...previous.peers];
      nextPeers[index] = {
        ...nextPeers[index],
        ...peer,
      };
      return { ...previous, peers: nextPeers };
    });
  }, []);

  const removePeer = useCallback((clientId: string) => {
    setSession((previous) => {
      if (!previous) return previous;
      return {
        ...previous,
        peers: previous.peers.filter((peer) => peer.clientId !== clientId),
      };
    });
  }, []);

  const connect = useCallback(() => {
    if (!roomId || isUnmountedRef.current) return;

    clearReconnectTimer();
    clearClientHeartbeat();

    const ws = new WebSocket(serverUrl);
    wsRef.current = ws;

    setStatus(retryAttemptRef.current === 0 ? "connecting" : "reconnecting");
    setIsReady(false);
    setSession((previous) => ({
      roomId,
      isHost,
      localUser: localUserRef.current,
      peers: previous?.peers ?? [],
      status: retryAttemptRef.current === 0 ? "connecting" : "reconnecting",
    }));

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
          } catch {
            // Ignore close errors.
          }
        }, CLIENT_PONG_TIMEOUT_MS);
      }, CLIENT_PING_INTERVAL_MS);
    };

    ws.onopen = () => {
      startClientHeartbeat();
      setSessionClosedByHost(false);
      setHostDisconnected(false);

      if (isHost) {
        const existingSnapshot = getSnapshotRef.current();
        const resolvedDiagramId =
          existingSnapshot?.diagramId ??
          (typeof activeDiagramId === "string" && activeDiagramId.length > 0 ? activeDiagramId : "");
        const snapshot =
          existingSnapshot ??
          {
            diagramId: resolvedDiagramId,
            diagramName: "",
            level: "context",
            components: {},
            connections: {},
            flows: {},
            nodeLayouts: {},
            edgeLayouts: [],
            iconLibrary: {},
            scenes: {},
            activeSceneId: null,
            compareSceneId: null,
          };

        ws.send(
          JSON.stringify({
            type: "host:join",
            roomId,
            diagramId:
              typeof activeDiagramId === "string" && activeDiagramId.length > 0 ? activeDiagramId : null,
            user: localUserRef.current,
            snapshot,
          }),
        );

        return;
      }

      ws.send(
        JSON.stringify({
          type: "guest:join",
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
          }
          if (isHost) {
            setStatus("connected");
            setIsReady(true);
            setSession({
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
          setStatus("reconnecting");
          setIsReady(false);
          return;
        }
        case "host:reconnected": {
          setStatus("connected");
          setIsReady(true);
          return;
        }
        case "session:init": {
          const snapshot = parseSnapshot(message.snapshot);
          if (!snapshot) return;

          onSnapshotRef.current(snapshot);

          const peers = parsePeers(message.peers);

          setStatus("connected");
          setIsReady(true);
          retryAttemptRef.current = 0;
          setSession({
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
          onPatchRef.current(patch);
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
          upsertPeer({ clientId, user, cursor: null, activeElementId: null });
          return;
        }
        case "peer:left": {
          const clientId = typeof message.clientId === "string" ? message.clientId : null;
          if (!clientId) return;
          removePeer(clientId);
          return;
        }
        case "peer:cursor": {
          const clientId = typeof message.clientId === "string" ? message.clientId : null;
          const userRaw = message.user;
          const user = isRecord(userRaw)
            ? {
                id: typeof userRaw.id === "string" ? userRaw.id : "",
                name: typeof userRaw.name === "string" ? userRaw.name : "",
                color: typeof userRaw.color === "string" ? userRaw.color : "#6366f1",
              }
            : null;
          const cursorValue = message.cursor;
          const cursor = cursorValue === null
            ? null
            : isRecord(cursorValue) &&
                typeof cursorValue.x === "number" &&
                typeof cursorValue.y === "number"
              ? { x: cursorValue.x, y: cursorValue.y }
              : null;
          const activeElementId: string | null =
            typeof message.activeElementId === "string" || message.activeElementId === null
              ? (message.activeElementId as string | null)
              : null;

          if (!clientId || !user?.id || !user.name) return;

          setSession((previous) => {
            if (!previous) return previous;
            const index = previous.peers.findIndex((peerState) => peerState.clientId === clientId);
            const existingCursor = index >= 0 ? previous.peers[index].cursor : null;
            const resolvedCursor = cursor !== null ? cursor : existingCursor;
            const updatedPeer: PeerState = {
              clientId,
              user,
              cursor: resolvedCursor,
              activeElementId,
            };
            if (index === -1) {
              return { ...previous, peers: [...previous.peers, updatedPeer] };
            }
            const nextPeers = [...previous.peers];
            nextPeers[index] = updatedPeer;
            return { ...previous, peers: nextPeers };
          });
          return;
        }
        case "session:closed": {
          shouldReconnectRef.current = false;
          intentionalCloseRef.current = true;
          setSessionClosedByHost(true);
          setStatus("closed");
          setIsReady(false);
          clearClientHeartbeat();
          try {
            ws.close(1000);
          } catch {
            // Ignore close errors.
          }
          return;
        }
        case "host:disconnected": {
          shouldReconnectRef.current = false;
          intentionalCloseRef.current = true;
          setHostDisconnected(true);
          setStatus("closed");
          setIsReady(false);
          clearClientHeartbeat();
          try {
            ws.close(1000);
          } catch {
            // Ignore close errors.
          }
          return;
        }
        case "error": {
          const code = typeof message.code === "string" ? message.code : "";

          if (code === "room_not_found" && !isHost) {
            roomNotFoundRetryRef.current = true;
            try {
              ws.close(4004, "room_not_found");
            } catch {
              // Ignore close errors.
            }
            return;
          }

          if (code === "room_full") {
            shouldReconnectRef.current = false;
            intentionalCloseRef.current = true;
            setStatus("disconnected");
            setIsReady(false);
            clearClientHeartbeat();
            try {
              ws.close(1008, "room_full");
            } catch {
              // Ignore close errors.
            }
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
        setStatus("disconnected");
        setIsReady(false);
        return;
      }

      const delay = RECONNECT_DELAYS_MS[retryAttemptRef.current];
      retryAttemptRef.current += 1;
      setStatus("reconnecting");
      setIsReady(false);

      reconnectTimerRef.current = setTimeout(() => {
        if (isUnmountedRef.current) return;
        connect();
      }, delay);
    };

    ws.onerror = () => {
      // Close handler drives reconnect flow.
    };
  }, [
    activeDiagramId,
    clearClientHeartbeat,
    clearReconnectTimer,
    isHost,
    roomId,
    serverUrl,
    upsertPeer,
    removePeer,
  ]);

  useEffect(() => {
    setSession((previous) => {
      if (!previous) return previous;
      return { ...previous, status };
    });
  }, [status]);

  useEffect(() => {
    if (!roomId) {
      setSession(null);
      setStatus("idle");
      setIsReady(false);
      return;
    }

    isUnmountedRef.current = false;
    intentionalCloseRef.current = false;
    shouldReconnectRef.current = true;
    roomNotFoundRetryRef.current = false;
    retryAttemptRef.current = 0;
    setSessionClosedByHost(false);
    setHostDisconnected(false);

    connect();

    return () => {
      isUnmountedRef.current = true;
      intentionalCloseRef.current = true;
      shouldReconnectRef.current = false;
      clearReconnectTimer();
      clearClientHeartbeat();

      const ws = wsRef.current;
      wsRef.current = null;
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        try {
          if (isHost && roomId) {
            ws.send(JSON.stringify({ type: "host:close", roomId }));
          }
          ws.close(1000, "unmount");
        } catch {
          // Ignore close errors.
        }
      }
    };
  }, [clearClientHeartbeat, clearReconnectTimer, connect, isHost, roomId]);

  const sendPatch = useCallback(
    (patch: CollabPatch) => {
      if (!roomId) return;
      const type = isHost ? "host:patch" : "guest:patch";
      sendRaw({ type, roomId, patch });
    },
    [isHost, roomId, sendRaw],
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

    setStatus("closed");
    setIsReady(false);
    setSession(null);
    clearClientHeartbeat();

    const ws = wsRef.current;
    wsRef.current = null;
    if (ws) {
      try {
        ws.close(1000);
      } catch {
        // Ignore close errors.
      }
    }
  }, [clearClientHeartbeat, isHost, roomId, sendRaw]);

  return {
    session,
    status,
    isReady,
    sessionClosedByHost,
    hostDisconnected,
    sendPatch,
    sendCursor,
    setActiveElement,
    closeSession,
  };
}
