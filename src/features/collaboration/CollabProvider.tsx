import { createContext, useContext, useMemo, type ReactNode } from "react";
import type * as Y from "yjs";
import type { WebrtcProvider } from "y-webrtc";
import { useActiveDiagramId } from "@/features/diagram";
import { useCollabAwareness } from "./useCollabAwareness";
import { useCollabSession } from "./useCollabSession";
import { useCollabUrlParam } from "./useCollabUrlParam";
import { useYjsZustandBridge } from "./useYjsZustandBridge";
import type { CollabSession, CollabUser } from "./types";

interface CollabContextValue {
  session: CollabSession | null;
  isReady: boolean;
  provider: WebrtcProvider | null;
  ydoc: Y.Doc | null;
  collabUrl: string;
  updateCursor: (cursor: { x: number; y: number } | null) => void;
  updateSelectedNode: (id: string | null) => void;
  updateViewport: (viewport: { x: number; y: number; zoom: number }) => void;
  updateEditingComponent: (componentId: string | null) => void;
  editingComponents: Map<string, CollabUser>;
}

const CollabContext = createContext<CollabContextValue>({
  session: null,
  isReady: false,
  provider: null,
  ydoc: null,
  collabUrl: "",
  updateCursor: () => {},
  updateSelectedNode: () => {},
  updateViewport: () => {},
  updateEditingComponent: () => {},
  editingComponents: new Map(),
});

export function useCollab() {
  return useContext(CollabContext);
}

interface CollabProviderProps {
  children: ReactNode;
  /** Forces guest mode with a specific room id (used by /collab/:roomId). */
  guestRoomId?: string;
  enabled?: boolean;
  userName?: string;
  signalingUrl?: string;
}

export function CollabProvider({
  children,
  guestRoomId,
  enabled = true,
  userName,
  signalingUrl,
}: CollabProviderProps) {
  const activeDiagramId = useActiveDiagramId();
  const { collabDiagramId: urlCollabId, generateCollabUrl } = useCollabUrlParam();

  const isGuest = Boolean(guestRoomId) || Boolean(urlCollabId);
  const bridgeDiagramId = enabled ? guestRoomId ?? urlCollabId ?? activeDiagramId : null;
  const isHost = !isGuest;

  const { ydoc, provider, session, isReady } = useCollabSession({
    diagramId: bridgeDiagramId,
    isHost,
    userName,
    signalingUrl,
  });

  useYjsZustandBridge(ydoc, bridgeDiagramId);

  const { updateCursor, updateSelectedNode, updateViewport, updateEditingComponent } =
    useCollabAwareness(provider);

  const editingComponents = useMemo(() => {
    const map = new Map<string, CollabUser>();
    if (!session) return map;

    session.peers.forEach((peer) => {
      if (peer.editingComponentId && peer.user) {
        map.set(peer.editingComponentId, peer.user);
      }
    });
    return map;
  }, [session]);

  const collabUrl = activeDiagramId ? generateCollabUrl(activeDiagramId) : "";

  return (
    <CollabContext.Provider
      value={{
        session,
        isReady,
        provider,
        ydoc,
        collabUrl,
        updateCursor,
        updateSelectedNode,
        updateViewport,
        updateEditingComponent,
        editingComponents,
      }}
    >
      {children}
    </CollabContext.Provider>
  );
}
