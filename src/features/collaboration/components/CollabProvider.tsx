import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useActiveDiagramId, useDiagramStore } from "@/features/diagram";
import { CollabSession } from "../sync/CollabSession";
import { newCollabRoomId } from "../utils/collab.utils";
import { readPrefs } from "../utils/collab-preferences";
import { clearHostSession, readHostSession, writeHostSession } from "../utils/hostSession";
import { randomColor } from "../utils/collab-colors";
import { useCollabStore } from "../store/collab.store";
import type { CollabSession as CollabSessionInfo, CollabUser } from "../types";
import { CollabRoomFullModal } from "./CollabRoomFullModal";
import { CollabContext, type CollabContextValue } from "./collab-context";
import { endReasonMessage } from "../utils/endReasonMessage";

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

function sameIgnoringCursors(a: CollabSessionInfo | null, b: CollabSessionInfo | null): boolean {
  if (a === b) return true;
  if (!a || !b) return false;
  if (
    a.roomId !== b.roomId ||
    a.isHost !== b.isHost ||
    a.localUser !== b.localUser ||
    a.status !== b.status ||
    a.peers.length !== b.peers.length
  ) {
    return false;
  }
  return a.peers.every((peer, index) => {
    const other = b.peers[index]!;
    return (
      peer.clientId === other.clientId &&
      peer.user === other.user &&
      peer.activeElementId === other.activeElementId
    );
  });
}

/** The store's session, keeping its previous identity while only cursors moved. */
function useSessionIgnoringCursors(): CollabSessionInfo | null {
  const previous = useRef<CollabSessionInfo | null>(null);
  return useCollabStore((state) => {
    if (sameIgnoringCursors(previous.current, state.session)) return previous.current;
    previous.current = state.session;
    return state.session;
  });
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
        // One toast per holder, however many of a multi-selection's locks were refused.
        toast.info(tRef.current("collaboration.lockedBy", { name: holderName }), {
          id: `collab-lock-denied:${holderName}`,
        });
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

  const session = useSessionIgnoringCursors();
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
  const lockElements = useCallback((ids: string[]) => {
    sessionRef.current?.client.sendLock("acquire", ids);
  }, []);
  const renewElementLocks = useCallback((ids: string[]) => {
    sessionRef.current?.client.sendLock("renew", ids);
  }, []);
  const unlockElements = useCallback((ids: string[]) => {
    sessionRef.current?.client.sendLock("release", ids);
  }, []);

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
      peerLimitReached: participantCount >= maxParticipants,
      lockElements,
      renewElementLocks,
      unlockElements,
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
      lockElements,
      renewElementLocks,
      unlockElements,
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
