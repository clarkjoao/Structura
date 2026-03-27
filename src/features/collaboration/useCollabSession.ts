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
const MAX_PARTICIPANTS = 5;
const MAX_PEER_CONNECTIONS = Math.max(1, MAX_PARTICIPANTS - 1);

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
    "ws://localhost:3000/ws";
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
  const [hostDisconnected, setHostDisconnected] = useState(false);
  const [peerLimitReached, setPeerLimitReached] = useState(false);
  const hostSeenRef = useRef(false);

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
  const sessionTerminatedRef = useRef(false);
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
    if (destroyedRef.current || sessionTerminatedRef.current || !diagramId) return undefined;

    cleanup();

    const roomId = diagramId.startsWith("structura-")
      ? diagramId
      : `structura-${diagramId}`;

    setStatus(retryCountRef.current === 0 ? "connecting" : "reconnecting");

    const newYdoc = new Y.Doc();
    const newProvider = new WebrtcProvider(roomId, newYdoc, {
      signaling: [resolvedSignalingUrl],
      maxConns: MAX_PEER_CONNECTIONS,
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
      isHost,
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
    let signalingTimeout: ReturnType<typeof setTimeout> | null = null;

    const onSynced = () => {
      if (destroyedRef.current) return;
      connectedOnce = true;
      retryCountRef.current = 0;
      if (retryTimerRef.current) {
        clearTimeout(retryTimerRef.current);
        retryTimerRef.current = null;
      }
      if (signalingTimeout) {
        clearTimeout(signalingTimeout);
        signalingTimeout = null;
      }
      setIsReady(true);
      setStatus("connected");
    };
    newProvider.on("synced", onSynced);

    // Detect unreachable signaling server: if after 8s the provider
    // never synced and no peers appeared, surface a disconnected status
    // so the UI can guide the user.
    signalingTimeout = setTimeout(() => {
      if (!connectedOnce && !destroyedRef.current && retryCountRef.current === 0) {
        const peerCount = newProvider.awareness.getStates().size - 1;
        if (peerCount <= 0) {
          setStatus("disconnected");
        }
      }
    }, 8000);

    if (!isHost) {
      syncTimeout = setTimeout(() => {
        if (!connectedOnce && !destroyedRef.current && !sessionTerminatedRef.current) {
          // Keep UI responsive even when synced event is delayed/missed.
          setIsReady(true);
          const retryDelay =
            RETRY_DELAYS_MS[Math.min(retryCountRef.current, RETRY_DELAYS_MS.length - 1)];
          retryCountRef.current += 1;
          setStatus("reconnecting");
          retryTimerRef.current = setTimeout(() => {
            if (!destroyedRef.current && !sessionTerminatedRef.current) connect();
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
      let hostPresent = false;
      newProvider.awareness.getStates().forEach((awarenessState, clientId) => {
        if (clientId === newProvider.awareness.clientID) return;
        if (awarenessState?.user) {
          peers.set(clientId, awarenessState as PeerAwareness);
          if (awarenessState.isHost) hostPresent = true;
        }
      });
      setPeerLimitReached(peers.size >= MAX_PARTICIPANTS - 1);

      // Track host presence for crash detection (guests only).
      if (!isHost) {
        if (hostPresent) {
          hostSeenRef.current = true;
          setHostDisconnected(false);
        } else if (hostSeenRef.current && !hostPresent) {
          // Host was seen before but is now gone — crash or browser close.
          setHostDisconnected(true);
          sessionTerminatedRef.current = true;
          cleanup();
          setSession(null);
          setIsReady(false);
          setStatus("closed");
          setPeerLimitReached(false);
          setYdoc(null);
          setProvider(null);
          return;
        }
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
      if (signalingTimeout) clearTimeout(signalingTimeout);
      newProvider.awareness.off("change", onAwarenessChange);
      newProvider.off("synced", onSynced);
      metaMap.unobserve(onMetaChange);
    };
  }, [cleanup, diagramId, isHost, resolvedSignalingUrl]);

  useEffect(() => {
    if (!diagramId) return;
    destroyedRef.current = false;
    retryCountRef.current = 0;
    sessionTerminatedRef.current = false;
    setIsReady(false);
    setStatus("idle");
    setSessionClosedByHost(false);
    setHostDisconnected(false);
    hostSeenRef.current = false;

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
    sessionTerminatedRef.current = true;
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
    hostDisconnected,
    peerLimitReached,
    closeSession,
    localUser: localUserRef.current,
  };
}