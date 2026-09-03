import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useActiveDiagramId, useDiagramStore } from "@/features/diagram";
import type { CollabPatch, CollabSnapshot } from "../hooks/useCollab";
import { useCollab as useWsCollab } from "../hooks/useCollab";
import { newCollabRoomId } from "../utils/collab.utils";
import { readPrefs } from "../utils/collab-preferences";
import { useCollabStoreSync } from "../hooks/useCollabStoreSync";
import { useCollabStore } from "../store/collab.store";
import type { CollabSession, CollabStatus, CollabUser } from "../types";
import { CollabRoomFullModal } from "./CollabRoomFullModal";

interface CollabContextValue {
  session: CollabSession | null;
  isReady: boolean;
  status: CollabStatus;
  isGuest: boolean;
  sessionClosedByHost: boolean;
  hostDisconnected: boolean;
  roomFullReason: string | null;
  participantCount: number;
  maxParticipants: number;
  closeSession: () => void;
  provider: null;
  ydoc: null;
  collabUrl: string;
  updateCursor: (cursor: { x: number; y: number } | null) => void;
  updateSelectedNode: (id: string | null) => void;
  updateViewport: (vp: { x: number; y: number; zoom: number }) => void;
  updateEditingComponent: (id: string | null) => void;
  editingComponents: Map<string, CollabUser>;
  peerLimitReached: boolean;
}

const CollabContext = createContext<CollabContextValue>({
  session: null,
  isReady: false,
  isGuest: false,
  status: "idle",
  sessionClosedByHost: false,
  hostDisconnected: false,
  roomFullReason: null,
  participantCount: 0,
  maxParticipants: 15,
  closeSession: () => {},
  provider: null,
  ydoc: null,
  collabUrl: "",
  updateCursor: () => {},
  updateSelectedNode: () => {},
  updateViewport: () => {},
  updateEditingComponent: () => {},
  editingComponents: new Map(),
  peerLimitReached: false,
});

export function useCollab() {
  return useContext(CollabContext);
}

interface CollabProviderProps {
  children: ReactNode;
  guestRoomId?: string;
  enabled?: boolean;

  reserveEphemeralRoomId?: boolean;
  userName?: string;
  signalingUrl?: string;
}

export function CollabProvider({
  children,
  guestRoomId,
  enabled = true,
  reserveEphemeralRoomId = false,
  userName,
  signalingUrl,
}: CollabProviderProps) {
  const activeDiagramId = useActiveDiagramId();
  const storePrefs = readPrefs();
  const [ephemeralRoomId, setEphemeralRoomId] = useState<string | null>(null);
  const pairedDiagramIdRef = useRef<string | null>(null);

  const isHost = !guestRoomId;

  useEffect(() => {
    if (!isHost) {
      return;
    }

    if (!activeDiagramId) {
      setEphemeralRoomId(null);
      pairedDiagramIdRef.current = null;
      return;
    }

    if (!enabled && !reserveEphemeralRoomId) {
      setEphemeralRoomId(null);
      pairedDiagramIdRef.current = null;
      return;
    }

    if (pairedDiagramIdRef.current !== activeDiagramId) {
      pairedDiagramIdRef.current = activeDiagramId;
      setEphemeralRoomId(newCollabRoomId());
      return;
    }

    setEphemeralRoomId((previous) => (previous === null ? newCollabRoomId() : previous));
  }, [activeDiagramId, enabled, isHost, reserveEphemeralRoomId]);

  const roomIdForWs = enabled ? (isHost ? ephemeralRoomId : (guestRoomId ?? null)) : null;

  const storeDiagramId = enabled && activeDiagramId ? activeDiagramId : null;

  const resolvedUserName =
    userName?.trim() || storePrefs.userName.trim() || `User-${Math.floor(Math.random() * 1000)}`;
  const resolvedServerUrl = signalingUrl?.trim() || storePrefs.serverUrl;

  const sendPatchRef = useRef<(patch: CollabPatch) => void>(() => {});

  const { getSnapshot, onPatch } = useCollabStoreSync({
    diagramId: storeDiagramId,
    sendPatchRef,
  });

  const onSnapshot = useCallback((snapshot: CollabSnapshot) => {
    useDiagramStore.setState((prev) => {
      const existing = prev.diagrams[snapshot.diagramId];
      const now = Date.now();
      return {
        ...prev,
        activeDiagramId: snapshot.diagramId,
        diagrams: {
          ...prev.diagrams,
          [snapshot.diagramId]: {
            id: snapshot.diagramId,
            name: snapshot.diagramName,
            level: snapshot.level,
            domain: snapshot.domain,
            description: snapshot.description,
            createdAt: existing?.createdAt ?? now,
            updatedAt: now,
            activeSceneId: snapshot.activeSceneId,
            compareSceneId: snapshot.compareSceneId,
            viewport: existing?.viewport ?? { x: 0, y: 0, zoom: 1 },
            snapshot: {
              components: snapshot.components,
              connections: snapshot.connections,
              flows: snapshot.flows,
              iconLibrary: snapshot.iconLibrary,
            },
            nodeLayouts: snapshot.nodeLayouts,
            edgeLayouts: snapshot.edgeLayouts,
            scenes: snapshot.scenes,
          },
        },
      };
    });
  }, []);

  const {
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
    closeSession: closeWsSession,
  } = useWsCollab({
    diagramId: roomIdForWs,
    activeDiagramId: isHost ? activeDiagramId : null,
    isHost,
    userName: resolvedUserName,
    serverUrl: resolvedServerUrl,
    getSnapshot,
    onSnapshot,
    onPatch,
  });

  sendPatchRef.current = sendPatch;

  const peerLimitReached = participantCount >= maxParticipants;

  const handleCloseSession = useCallback(() => {
    closeWsSession();
    setEphemeralRoomId(null);
    pairedDiagramIdRef.current = null;
  }, [closeWsSession]);

  useEffect(() => {
    if (!isHost || !session) {
      return;
    }

    const handleBeforeUnload = () => {
      handleCloseSession();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [handleCloseSession, isHost, session]);

  const collabUrl = useMemo(() => {
    if (!isHost || !ephemeralRoomId || typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    return `${url.protocol}//${url.host}/collab/${ephemeralRoomId}`;
  }, [ephemeralRoomId, isHost]);

  const updateCursor = useCallback(
    (cursor: { x: number; y: number } | null) => {
      sendCursor(cursor);
    },
    [sendCursor],
  );

  const updateSelectedNode = useCallback(
    (_id: string | null) => {
      setActiveElement(_id);
    },
    [setActiveElement],
  );

  /**
   * Viewport sync for collaboration sessions.
   *
   * BACKLOG: When a user pans or zooms their canvas, broadcast the viewport to
   * peers so they can optionally follow along or see where others are looking.
   *
   * Implementation would require:
   * 1. Adding a "viewport" message type to the collab channel protocol
   * 2. Sending viewport updates on canvas pan/zoom (throttled to avoid flooding)
   * 3. Receiving and applying viewport changes from peers
   *
   * This is low-priority compared to element sync which is the core collab feature.
   */
  const updateViewport = useCallback((_vp: { x: number; y: number; zoom: number }) => {
    // Not implemented - see BACKLOG note above
  }, []);

  const updateEditingComponent = useCallback(
    (_id: string | null) => {
      setActiveElement(_id);
    },
    [setActiveElement],
  );

  const editingComponents = useMemo(() => {
    const map = new Map<string, CollabUser>();
    if (!session) return map;
    for (const peer of session.peers) {
      if (peer.activeElementId) {
        map.set(peer.activeElementId, peer.user);
      }
    }
    return map;
  }, [session]);

  const [showRoomFullModal, setShowRoomFullModal] = useState(false);

  // Show room full modal when roomFullReason is set
  useEffect(() => {
    if (roomFullReason) {
      setShowRoomFullModal(true);
    }
  }, [roomFullReason]);

  const handleCloseRoomFullModal = useCallback(() => {
    setShowRoomFullModal(false);
    useCollabStore.getState().setRoomFullReason(null);
  }, []);

  return (
    <>
      <CollabRoomFullModal
        isOpen={showRoomFullModal}
        reason={roomFullReason}
        onClose={handleCloseRoomFullModal}
      />
      <CollabContext.Provider
        value={{
          session,
          isReady,
          status,
          isGuest: isHost ? false : session !== null && !session.isHost,
          sessionClosedByHost,
          hostDisconnected,
          roomFullReason,
          participantCount,
          maxParticipants,
          closeSession: handleCloseSession,
          provider: null,
          ydoc: null,
          collabUrl,
          updateCursor,
          updateSelectedNode,
          updateViewport,
          updateEditingComponent,
          editingComponents,
          peerLimitReached,
        }}
      >
        {children}
      </CollabContext.Provider>
    </>
  );
}
