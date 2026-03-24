import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebrtcProvider } from "y-webrtc";
import { IndexeddbPersistence } from "y-indexeddb";
import type { CollabUser, CollabSession, PeerAwareness } from "./types";

const SIGNALING_URL = import.meta.env.VITE_SIGNALING_URL ?? "ws://localhost:4444";

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

interface UseCollabSessionParams {
  diagramId: string | null;
  isHost: boolean;
}

export function useCollabSession({ diagramId, isHost }: UseCollabSessionParams) {
  // ── CORREÇÃO: usar useState em vez de useRef para ydoc e provider ──
  // useRef retorna null no primeiro render e o CollabProvider passa null
  // para useYjsZustandBridge que nunca re-executa.
  const [ydoc, setYdoc] = useState<Y.Doc | null>(null);
  const [provider, setProvider] = useState<WebrtcProvider | null>(null);

  const localUserRef = useRef<CollabUser>({
    id: generateUserId(),
    name: `User-${Math.floor(Math.random() * 1000)}`,
    color: randomColor(),
  });

  const [session, setSession] = useState<CollabSession | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    if (!diagramId) return;
    setIsReady(false);

    const roomId = diagramId.startsWith("structura-")
      ? diagramId
      : `structura-${diagramId}`;

    const newYdoc = new Y.Doc();
    const newProvider = new WebrtcProvider(roomId, newYdoc, {
      signaling: [SIGNALING_URL],
    });
    const persistence = new IndexeddbPersistence(roomId, newYdoc);

    const localUser = localUserRef.current;
    newProvider.awareness.setLocalState({
      user: localUser,
      cursor: null,
      selectedNodeId: null,
    });

    // ── Expor via state para trigger correto no useYjsZustandBridge ──
    setYdoc(newYdoc);
    setProvider(newProvider);

    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const handleProviderSynced = () => {
      if (timeoutId) clearTimeout(timeoutId);
      setIsReady(true);
    };

    if (!isHost) {
      timeoutId = setTimeout(() => setIsReady(true), 3000);
      newProvider.on("synced", handleProviderSynced);
    } else {
      persistence.on("synced", () => setIsReady(true));
    }

    const onAwarenessChange = () => {
      const peers = new Map<number, PeerAwareness>();
      newProvider.awareness.getStates().forEach((state, clientId) => {
        if (clientId === newProvider.awareness.clientID) return;
        if (state?.user) {
          peers.set(clientId, state as PeerAwareness);
        }
      });

      setSession((prev) => ({
        roomId,
        isHost,
        localUser,
        peers,
        isReady: prev?.isReady ?? false,
      }));
    };

    newProvider.awareness.on("change", onAwarenessChange);
    setSession({ roomId, isHost, localUser, peers: new Map(), isReady: false });

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
      newProvider.awareness.off("change", onAwarenessChange);
      newProvider.off("synced", handleProviderSynced);
      newProvider.destroy();
      newYdoc.destroy();
      setYdoc(null);
      setProvider(null);
    };
  }, [diagramId, isHost]);

  useEffect(() => {
    setSession((prev) => (prev ? { ...prev, isReady } : prev));
  }, [isReady]);

  return { ydoc, provider, session, isReady, localUser: localUserRef.current };
}