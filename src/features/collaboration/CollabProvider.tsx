import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  type ReactNode,
} from "react";
import { useActiveDiagramId, useDiagramStore } from "@/features/diagram";
import type { CollabPatch, CollabSnapshot } from "./useCollab";
import { useCollab as useWsCollab } from "./useCollab";
import { readPrefs } from "./collabPreferences";
import { useCollabStoreSync } from "./useCollabStoreSync";
import type { CollabSession, CollabStatus, CollabUser } from "./types";

interface CollabContextValue {
  session: CollabSession | null;
  isReady: boolean;
  status: CollabStatus;
  sessionClosedByHost: boolean;
  hostDisconnected: boolean;
  closeSession: () => void;
  // always null — kept for API compat
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
  status: "idle",
  sessionClosedByHost: false,
  hostDisconnected: false,
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
  userName?: string;
  signalingUrl?: string; // maps to serverUrl
}

export function CollabProvider({
  children,
  guestRoomId,
  enabled = true,
  userName,
  signalingUrl,
}: CollabProviderProps) {
  const activeDiagramId = useActiveDiagramId();
  const storePrefs = readPrefs();

  const diagramId = enabled ? guestRoomId ?? activeDiagramId : null;
  const isHost = !guestRoomId;

  const resolvedUserName =
    userName?.trim() || storePrefs.userName.trim() || `User-${Math.floor(Math.random() * 1000)}`;
  const resolvedServerUrl = signalingUrl?.trim() || storePrefs.serverUrl;

  const sendPatchRef = useRef<(patch: CollabPatch) => void>(() => {});

  const { getSnapshot, onPatch } = useCollabStoreSync({
    diagramId,
    sendPatchRef,
  });

  const onSnapshot = useCallback((snapshot: CollabSnapshot) => {
    useDiagramStore.setState((prev) => {
      const existing = prev.diagrams[snapshot.diagramId];
      const now = new Date().toISOString();
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
    sendPatch,
    sendCursor,
    setActiveElement,
    closeSession,
  } = useWsCollab({
    diagramId,
    isHost,
    userName: resolvedUserName,
    serverUrl: resolvedServerUrl,
    getSnapshot,
    onSnapshot,
    onPatch,
  });

  sendPatchRef.current = sendPatch;

  const collabUrl = diagramId ? `${window.location.origin}/collab/${diagramId}` : "";

  const updateCursor = useCallback(
    (cursor: { x: number; y: number } | null) => {
      sendCursor(cursor);
    },
    [sendCursor],
  );

  const updateSelectedNode = useCallback((_id: string | null) => {
    setActiveElement(_id);
  }, [setActiveElement]);

  const updateViewport = useCallback((_vp: { x: number; y: number; zoom: number }) => {
    // no-op for now
  }, []);

  const updateEditingComponent = useCallback((_id: string | null) => {
    setActiveElement(_id);
  }, [setActiveElement]);

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

  const peerLimitReached = (session?.peers.length ?? 0) >= 4;

  return (
    <CollabContext.Provider
      value={{
        session,
        isReady,
        status,
        sessionClosedByHost,
        hostDisconnected,
        closeSession,
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
  );
}
