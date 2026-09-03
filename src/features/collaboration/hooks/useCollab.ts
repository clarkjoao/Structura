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
  const lastCursorRef = useRef<{ x: number; y: number } | null>(null);

  const session = useCollabStore((state) => state.session);
  const status = useCollabStore((state) => state.status);
  const isReady = useCollabStore((state) => state.isReady);
  const sessionClosedByHost = useCollabStore((state) => state.sessionClosedByHost);
  const hostDisconnected = useCollabStore((state) => state.hostDisconnected);

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
        // malformed payload, will be skipped by the null check below
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

          const storeInit = useCollabStore.getState();
          storeInit.setIsReady(true);
          retryAttemptRef.current = 0;
          storeInit.setSession({
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
          useCollabStore.getState().upsertPeer({
            clientId,
            user,
            cursor: null,
            activeElementId: null,
          });
          return;
        }
        case "peer:left": {
          const clientId = typeof message.clientId === "string" ? message.clientId : null;
          if (!clientId) return;
          useCollabStore.getState().removePeer(clientId);
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
          const cursor =
            cursorValue === null
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

          useCollabStore.getState().applyPeerCursorPayload({
            clientId,
            user,
            cursor,
            activeElementId,
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
            const storeFull = useCollabStore.getState();
            storeFull.setStatus("disconnected");
            storeFull.setIsReady(false);
            clearClientHeartbeat();
            try {
              ws.close(1008, "room_full");
            } catch (err) {
              console.warn("[useCollab] Failed to close WebSocket on room_full:", err);
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
    sendPatch,
    sendCursor,
    setActiveElement,
    closeSession,
  };
}
