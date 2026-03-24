import { createContext, useContext, type ReactNode } from "react";
import type * as Y from "yjs";
import type { WebrtcProvider } from "y-webrtc";
import { useActiveDiagramId } from "@/features/diagram";
import { useCollabAwareness } from "./useCollabAwareness";
import { useCollabSession } from "./useCollabSession";
import { useCollabUrlParam } from "./useCollabUrlParam";
import { useYjsZustandBridge } from "./useYjsZustandBridge";
import type { CollabSession } from "./types";

interface CollabContextValue {
  session: CollabSession | null;
  isReady: boolean;
  provider: WebrtcProvider | null;
  ydoc: Y.Doc | null;
  collabUrl: string;
  updateCursor: (cursor: { x: number; y: number } | null) => void;
  updateSelectedNode: (id: string | null) => void;
  updateViewport: (viewport: { x: number; y: number; zoom: number }) => void;
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
});

export function useCollab() {
  return useContext(CollabContext);
}

interface CollabProviderProps {
  children: ReactNode;
  /** Forces guest mode with a specific room id (used by /collab/:roomId). */
  guestRoomId?: string;
}

export function CollabProvider({ children, guestRoomId }: CollabProviderProps) {
  const activeDiagramId = useActiveDiagramId();
  const { collabDiagramId: urlCollabId, generateCollabUrl } = useCollabUrlParam();

  const isGuest = Boolean(guestRoomId) || Boolean(urlCollabId);
  const bridgeDiagramId = guestRoomId ?? urlCollabId ?? activeDiagramId;
  const isHost = !isGuest;

  const { ydoc, provider, session, isReady } = useCollabSession({
    diagramId: bridgeDiagramId,
    isHost,
  });

  useYjsZustandBridge(ydoc, bridgeDiagramId);

  const { updateCursor, updateSelectedNode, updateViewport } = useCollabAwareness(provider);

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
      }}
    >
      {children}
    </CollabContext.Provider>
  );
}
