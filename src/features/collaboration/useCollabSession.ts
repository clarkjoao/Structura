import { useCallback, useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { IndexeddbPersistence } from "y-indexeddb";
import type {
  CollabConnectionStatus,
  CollabSession,
  CollabUser,
  PeerAwareness,
} from "./types";
import { readCollabPreferences } from "./collabPreferences";

const PEER_COLORS = [
  "#6366f1", "#f59e0b", "#10b981", "#ef4444",
  "#06b6d4", "#8b5cf6", "#f97316", "#ec4899",
];

function randomColor(): string {
  return PEER_COLORS[Math.floor(Math.random() * PEER_COLORS.length)];
}

function generateUserId(): string {
  return `user-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
}

const SESSION_CLOSED_KEY = "sessionClosed";
const RETRY_DELAYS_MS = [2000, 4000, 8000, 15000, 30000];

interface UseCollabSessionParams {
  diagramId: string | null;
  isHost: boolean;
  userName?: string;
  signalingUrl?: string;
}

export function useCollabSession({
  diagramId,
  isHost,
  userName: userNameProp,
  signalingUrl: signalingUrlProp,
}: UseCollabSessionParams) {
  const preferences = readCollabPreferences();
  const resolvedSignalingUrl =
    signalingUrlProp ??
    preferences.signalingUrl ??
    import.meta.env.VITE_SIGNALING_URL ??
    "ws://localhost:4444";
  const resolvedUserName =
    userNameProp ??
    preferences.userName ??
    `User-${Math.floor(Math.random() * 1000)}`;

  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebrtcProvider | null>(null);
  const [session, setSession] = useState<CollabSession | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [status, setStatus] = useState<CollabConnectionStatus>("idle");
  const [sessionClosedByHost, setSessionClosedByHost] = useState(false);

  const localUserRef = useRef<CollabUser>({
    id: generateUserId(),
    name: resolvedUserName,
    color: randomColor(),
  });
  if (localUserRef.current.name !== resolvedUserName && resolvedUserName) {
    localUserRef.current = { ...localUserRef.current, name: resolvedUserName };
  }

  const retryCountRef = useRef(0);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const destroyedRef = useRef(false);
  const currentProviderRef = useRef<WebrtcProvider | null>(null);
  const currentYdocRef = useRef<Y.Doc | null>(null);

  const cleanup = useCallback(() => {
    if (retryTimerRef.current) {
      clearTimeout(retryTimerRef.current);
      retryTimerRef.current = null;
    }
    if (currentProviderRef.current) {
      try {
        currentProviderRef.current.destroy();
      } catch {
        // Ignore destroy errors.
      }
      currentProviderRef.current = null;
    }
    if (currentYdocRef.current) {
      try {
        currentYdocRef.current.destroy();
      } catch {
        // Ignore destroy errors.
      }
      currentYdocRef.current = null;
    }
  }, []);

  const connect = useCallback(() => {
    if (destroyedRef.current || !diagramId) return undefined;

    cleanup();

    const roomId = diagramId.startsWith("structura-")
      ? diagramId
      : `structura-${diagramId}`;

    setStatus(retryCountRef.current === 0 ? "connecting" : "reconnecting");

    const newYdoc = new Y.Doc();
    const newProvider = new WebrtcProvider(roomId, newYdoc, {
      signaling: [resolvedSignalingUrl],
    });
    const persistence = new IndexeddbPersistence(roomId, newYdoc);

    currentYdocRef.current = newYdoc;
    currentProviderRef.current = newProvider;

    const localUser = localUserRef.current;
    newProvider.awareness.setLocalState({
      user: localUser,
      cursor: null,
      selectedNodeId: null,
      editingComponentId: null,
    });

    setYdoc(newYdoc);
    setProvider(newProvider);

    const metaMap = newYdoc.getMap("meta");
    const onMetaChange = () => {
      if (!isHost && metaMap.get(SESSION_CLOSED_KEY) === true) {
        setSessionClosedByHost(true);
        setStatus("closed");
      }
    };
    metaMap.observe(onMetaChange);

    let connectedOnce = false;
    let syncTimeout: ReturnType<typeof setTimeout> | null = null;

    const onSynced = () => {
      if (destroyedRef.current) return;
      connectedOnce = true;
      retryCountRef.current = 0;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      setIsReady(true);
      setStatus("connected");
    };
    newProvider.on("synced", onSynced);

    if (!isHost) {
      syncTimeout = setTimeout(() => {
        if (!connectedOnce && !destroyedRef.current) {
          // Keep UI responsive even when synced event is delayed/missed.
          setIsReady(true);
          const retryDelay =
            RETRY_DELAYS_MS[Math.min(retryCountRef.current, RETRY_DELAYS_MS.length - 1)];
          retryCountRef.current += 1;
          setStatus("reconnecting");
          retryTimerRef.current = setTimeout(() => {
            if (!destroyedRef.current) connect();
          }, retryDelay);
        }
      }, 5000);
    } else {
      persistence.on("synced", () => {
        if (!destroyedRef.current) {
          setIsReady(true);
          setStatus("connected");
        }
      });
    }

    const onAwarenessChange = () => {
      if (destroyedRef.current) return;
      const peers = new Map<number, PeerAwareness>();
      newProvider.awareness.getStates().forEach((awarenessState, clientId) => {
        if (clientId === newProvider.awareness.clientID) return;
        if (awarenessState?.user) {
          peers.set(clientId, awarenessState as PeerAwareness);
        }
      });
      if (!isHost) {
        setIsReady(true);
      }

      setSession((previousSession) => ({
        roomId,
        isHost,
        localUser,
        peers,
        isReady: previousSession?.isReady ?? false,
        status: previousSession?.status ?? "connecting",
      }));
    };
    newProvider.awareness.on("change", onAwarenessChange);

    setSession({
      roomId,
      isHost,
      localUser,
      peers: new Map(),
      isReady: false,
      status: "connecting",
    });

    return () => {
      if (syncTimeout) clearTimeout(syncTimeout);
      newProvider.awareness.off("change", onAwarenessChange);
      newProvider.off("synced", onSynced);
      metaMap.unobserve(onMetaChange);
    };
  }, [cleanup, diagramId, isHost, resolvedSignalingUrl]);

  useEffect(() => {
    if (!diagramId) return;
    destroyedRef.current = false;
    retryCountRef.current = 0;
    setIsReady(false);
    setStatus("idle");
    setSessionClosedByHost(false);

    const unsubscribeConnect = connect();

    return () => {
      destroyedRef.current = true;
      unsubscribeConnect?.();
      cleanup();
      setYdoc(null);
      setProvider(null);
      setSession(null);
    };
  }, [cleanup, connect, diagramId, isHost, resolvedSignalingUrl]);

  const closeSession = useCallback(() => {
    if (!isHost || !currentYdocRef.current) return;
    const metaMap = currentYdocRef.current.getMap("meta");
    metaMap.set(SESSION_CLOSED_KEY, true);
    setTimeout(() => {
      cleanup();
      setSession(null);
      setIsReady(false);
      setStatus("closed");
      setYdoc(null);
      setProvider(null);
    }, 500);
  }, [cleanup, isHost]);

  useEffect(() => {
    setSession((previousSession) =>
      previousSession ? { ...previousSession, isReady, status } : previousSession,
    );
  }, [isReady, status]);

  return {
    ydoc,
    provider,
    session,
    isReady,
    status,
    sessionClosedByHost,
    closeSession,
    localUser: localUserRef.current,
  };
}