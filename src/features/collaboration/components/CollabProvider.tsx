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
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useActiveDiagramId, useDiagramStore } from "@/features/diagram";
import { CollabSession } from "../sync/CollabSession";
import { newCollabRoomId } from "../utils/collab.utils";
import { readPrefs } from "../utils/collab-preferences";
import { clearHostSession, readHostSession, writeHostSession } from "../utils/hostSession";
import { randomColor } from "../utils/collab-colors";
import { useCollabStore } from "../store/collab.store";
import type { CollabSession as CollabSessionInfo, CollabStatus, CollabUser } from "../types";
import { CollabRoomFullModal } from "./CollabRoomFullModal";
import { endReasonMessage } from "../utils/endReasonMessage";

interface CollabContextValue {
  session: CollabSessionInfo | null;
  isReady: boolean;
  status: CollabStatus;
  isGuest: boolean;
  hostOnline: boolean;
  sessionClosedByHost: boolean;
  hostDisconnected: boolean;
  roomFullReason: string | null;
  participantCount: number;
  maxParticipants: number;
  closeSession: () => void;
  collabUrl: string;
  updateCursor: (cursor: { x: number; y: number } | null) => void;
  updateSelectedNode: (id: string | null) => void;
  updateEditingComponent: (id: string | null) => void;
  editingComponents: Map<string, CollabUser>;
  peerLimitReached: boolean;
  /** Ask for the soft lock on an element for a drag or text edit (see collab-presence). */
  lockElement: (id: string) => void;
  renewElementLock: (id: string) => void;
  unlockElement: (id: string) => void;
}

const CollabContext = createContext<CollabContextValue>({
  session: null,
  isReady: false,
  isGuest: false,
  hostOnline: true,
  status: "idle",
  sessionClosedByHost: false,
  hostDisconnected: false,
  roomFullReason: null,
  participantCount: 0,
  maxParticipants: 50,
  closeSession: () => {},
  collabUrl: "",
  updateCursor: () => {},
  updateSelectedNode: () => {},
  updateEditingComponent: () => {},
  editingComponents: new Map(),
  peerLimitReached: false,
  lockElement: () => {},
  renewElementLock: () => {},
  unlockElement: () => {},
});

export function useCollab() {
  return useContext(CollabContext);
}

interface CollabProviderProps {
  children: ReactNode;
  guestRoomId?: string;
  enabled?: boolean;
  /** Mint the room id early, so the start dialog can show the invite link before it starts. */
  reserveEphemeralRoomId?: boolean;
  userName?: string;
  signalingUrl?: string;
  /** Host: the session ended on its own (refused, too large, unreachable…), not by the host. */
  onHostSessionEnded?: () => void;
}

function makeUser(id: string | undefined, name: string, color: string | undefined): CollabUser {
  const userId = id ?? newCollabRoomId();
  return { id: userId, name, color: color ?? randomColor() };
}

export function CollabProvider({
  children,
  guestRoomId,
  enabled = true,
  reserveEphemeralRoomId = false,
  userName,
  signalingUrl,
  onHostSessionEnded,
}: CollabProviderProps) {
  const { t } = useTranslation();
  const activeDiagramId = useActiveDiagramId();
  const isHost = !guestRoomId;
  const prefs = readPrefs();

  // A host who reloaded its tab mid-session picks the session back up from sessionStorage.
  const storedHost = useMemo(
    () => (isHost && activeDiagramId ? readHostSession(activeDiagramId) : null),
    [activeDiagramId, isHost],
  );

  const [ephemeralRoomId, setEphemeralRoomId] = useState<string | null>(null);
  const pairedDiagramIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isHost) return;
    if (!activeDiagramId || (!enabled && !reserveEphemeralRoomId)) {
      setEphemeralRoomId(null);
      pairedDiagramIdRef.current = null;
      return;
    }
    if (pairedDiagramIdRef.current !== activeDiagramId) {
      pairedDiagramIdRef.current = activeDiagramId;
      setEphemeralRoomId(newCollabRoomId());
      return;
    }
    setEphemeralRoomId((previous) => previous ?? newCollabRoomId());
  }, [activeDiagramId, enabled, isHost, reserveEphemeralRoomId]);

  const roomId = isHost ? (storedHost?.roomId ?? ephemeralRoomId) : (guestRoomId ?? null);
  const active = isHost ? Boolean(activeDiagramId && roomId && (enabled || storedHost)) : true;
  const serverUrl = storedHost?.serverUrl ?? (signalingUrl?.trim() || prefs.serverUrl);
  const resolvedName =
    storedHost?.userName ??
    (userName?.trim() || prefs.userName.trim() || `User-${Math.floor(Math.random() * 1000)}`);

  const sessionRef = useRef<CollabSession | null>(null);
  const onHostEndedRef = useRef(onHostSessionEnded);
  onHostEndedRef.current = onHostSessionEnded;
  const tRef = useRef(t);
  tRef.current = t;

  useEffect(() => {
    if (!active || !roomId) return;
    const diagramId = isHost ? activeDiagramId : null;
    const user = makeUser(storedHost?.userId, resolvedName, storedHost?.color);
    useCollabStore.getState().reset();

    const session = new CollabSession({
      url: serverUrl,
      roomId,
      user,
      role: isHost ? "host" : "guest",
      diagramId,
      hostToken: storedHost?.hostToken ?? null,
      diagramStore: useDiagramStore,
      collabStore: useCollabStore,
      onHostToken: (hostToken) => {
        if (!diagramId) return;
        writeHostSession(diagramId, {
          roomId,
          hostToken,
          serverUrl,
          userName: user.name,
          userId: user.id,
          color: user.color,
        });
      },
      onLockDenied: (_entityId, holderName) => {
        toast.info(tRef.current("collaboration.lockedBy", { name: holderName }));
      },
      onEnded: (reason) => {
        if (diagramId) clearHostSession(diagramId);
        if (!isHost || reason === "left") return;
        // The host's own session ended without the host ending it: say why, and go back to the
        // not-collaborating state so a new session can be started.
        const { endDetail } = useCollabStore.getState();
        toast.error(endReasonMessage(tRef.current, reason, endDetail, user.name));
        useCollabStore.getState().reset();
        setEphemeralRoomId(null);
        pairedDiagramIdRef.current = null;
        onHostEndedRef.current?.();
      },
    });
    sessionRef.current = session;
    session.start();

    return () => {
      // Unmount or navigation is not "end session": the room waits out the host's grace period,
      // so a reload or a quick return picks it back up.
      session.disconnect();
      if (sessionRef.current === session) sessionRef.current = null;
    };
    // The session is keyed by room and server; the rest is read once at start.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, roomId, serverUrl, isHost]);

  const session = useCollabStore((s) => s.session);
  const status = useCollabStore((s) => s.status);
  const isReady = useCollabStore((s) => s.isReady);
  const hostOnline = useCollabStore((s) => s.hostOnline);
  const sessionClosedByHost = useCollabStore((s) => s.sessionClosedByHost);
  const hostDisconnected = useCollabStore((s) => s.hostDisconnected);
  const roomFullReason = useCollabStore((s) => s.roomFullReason);
  const participantCount = useCollabStore((s) => s.participantCount);
  const maxParticipants = useCollabStore((s) => s.maxParticipants);

  const closeSession = useCallback(() => {
    const current = sessionRef.current;
    if (activeDiagramId) clearHostSession(activeDiagramId);
    current?.leave();
    sessionRef.current = null;
    useCollabStore.getState().reset();
    setEphemeralRoomId(null);
    pairedDiagramIdRef.current = null;
  }, [activeDiagramId]);

  const collabUrl = useMemo(() => {
    if (!isHost || !roomId || typeof window === "undefined") return "";
    const url = new URL(window.location.href);
    return `${url.protocol}//${url.host}/collab/${roomId}`;
  }, [roomId, isHost]);

  const updateCursor = useCallback((cursor: { x: number; y: number } | null) => {
    sessionRef.current?.updateCursor(cursor);
  }, []);
  const updateActive = useCallback((id: string | null) => {
    sessionRef.current?.updateActiveElement(id);
  }, []);
  const lockElement = useCallback((id: string) => {
    sessionRef.current?.client.sendLock("acquire", id);
  }, []);
  const renewElementLock = useCallback((id: string) => {
    sessionRef.current?.client.sendLock("renew", id);
  }, []);
  const unlockElement = useCallback((id: string) => {
    sessionRef.current?.client.sendLock("release", id);
  }, []);

  const editingComponents = useMemo(() => {
    const map = new Map<string, CollabUser>();
    for (const peer of session?.peers ?? []) {
      if (peer.activeElementId) map.set(peer.activeElementId, peer.user);
    }
    return map;
  }, [session]);

  const handleCloseRoomFullModal = useCallback(() => {
    useCollabStore.getState().setRoomFullReason(null);
  }, []);

  const value = useMemo<CollabContextValue>(
    () => ({
      session,
      isReady,
      status,
      isGuest: !isHost && session !== null,
      hostOnline,
      sessionClosedByHost,
      hostDisconnected,
      roomFullReason,
      participantCount,
      maxParticipants,
      closeSession,
      collabUrl,
      updateCursor,
      updateSelectedNode: updateActive,
      updateEditingComponent: updateActive,
      editingComponents,
      peerLimitReached: participantCount >= maxParticipants,
      lockElement,
      renewElementLock,
      unlockElement,
    }),
    [
      session,
      isReady,
      status,
      isHost,
      hostOnline,
      sessionClosedByHost,
      hostDisconnected,
      roomFullReason,
      participantCount,
      maxParticipants,
      closeSession,
      collabUrl,
      updateCursor,
      updateActive,
      editingComponents,
      lockElement,
      renewElementLock,
      unlockElement,
    ],
  );

  return (
    <>
      <CollabRoomFullModal
        isOpen={roomFullReason !== null}
        limit={maxParticipants}
        onClose={handleCloseRoomFullModal}
      />
      <CollabContext.Provider value={value}>{children}</CollabContext.Provider>
    </>
  );
}
