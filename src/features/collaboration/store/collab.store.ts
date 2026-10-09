import { create } from "zustand";
import type {
  CollabEndReason,
  CollabSession,
  CollabStatus,
  CollabUser,
  ElementLock,
  PeerState,
} from "../types";

export interface CollabStoreState {
  session: CollabSession | null;
  status: CollabStatus;
  /** The room state has been received at least once; stays true across reconnects. */
  isReady: boolean;
  hostOnline: boolean;
  hostName: string | null;
  endReason: CollabEndReason | null;
  /** Size and limit for a "too large" end. */
  endDetail: { size?: number; limit?: number } | null;
  sessionClosedByHost: boolean;
  hostDisconnected: boolean;
  roomFullReason: string | null;
  participantCount: number;
  maxParticipants: number;
  /** Soft locks held by other participants, by element id. */
  locks: Record<string, ElementLock>;

  setSession: (session: CollabSession | null) => void;
  setStatus: (status: CollabStatus) => void;
  setIsReady: (value: boolean) => void;
  setHostOnline: (value: boolean) => void;
  setHostName: (name: string | null) => void;
  setEnded: (reason: CollabEndReason, detail?: { size?: number; limit?: number }) => void;
  setRoomFullReason: (reason: string | null) => void;
  setParticipantCount: (count: number, max: number) => void;
  setPeers: (peers: PeerState[]) => void;
  upsertPeer: (peer: PeerState) => void;
  removePeer: (clientId: string) => void;
  applyPeerCursorPayload: (input: {
    clientId: string;
    user: CollabUser;
    cursor: { x: number; y: number } | null;
    activeElementId: string | null;
    preserveCursorIfMessageNull: boolean;
  }) => void;
  setLock: (entityId: string, lock: ElementLock | null) => void;
  reset: () => void;
}

const INITIAL = {
  session: null,
  status: "idle" as CollabStatus,
  isReady: false,
  hostOnline: true,
  hostName: null,
  endReason: null,
  endDetail: null,
  sessionClosedByHost: false,
  hostDisconnected: false,
  roomFullReason: null,
  participantCount: 0,
  maxParticipants: 50,
  locks: {},
};

export const createCollabStore = () =>
  create<CollabStoreState>((set) => ({
    ...INITIAL,

    setSession: (session) =>
      set(() => ({
        session,
        ...(session ? { status: session.status } : {}),
      })),

    setStatus: (status) =>
      set((state) => ({
        status,
        session: state.session ? { ...state.session, status } : null,
      })),

    setIsReady: (isReady) => set({ isReady }),

    setHostOnline: (hostOnline) => set({ hostOnline }),

    setHostName: (hostName) => set({ hostName }),

    setEnded: (reason, detail) =>
      set({
        endReason: reason,
        endDetail: detail ?? null,
        sessionClosedByHost: reason === "host_closed",
        hostDisconnected: reason === "host_timeout",
      }),

    setRoomFullReason: (roomFullReason) => set({ roomFullReason }),

    setParticipantCount: (count, max) => set({ participantCount: count, maxParticipants: max }),

    setPeers: (peers) =>
      set((state) => (state.session ? { session: { ...state.session, peers } } : state)),

    upsertPeer: (peer) =>
      set((state) => {
        if (!state.session) return state;
        const index = state.session.peers.findIndex(
          (existing) => existing.clientId === peer.clientId,
        );
        if (index === -1) {
          return {
            session: { ...state.session, peers: [...state.session.peers, peer] },
          };
        }
        const nextPeers = [...state.session.peers];
        nextPeers[index] = { ...nextPeers[index]!, ...peer };
        return { session: { ...state.session, peers: nextPeers } };
      }),

    removePeer: (clientId) =>
      set((state) => {
        if (!state.session) return state;
        return {
          session: {
            ...state.session,
            peers: state.session.peers.filter((peer) => peer.clientId !== clientId),
          },
        };
      }),

    applyPeerCursorPayload: ({
      clientId,
      user,
      cursor,
      activeElementId,
      preserveCursorIfMessageNull,
    }) =>
      set((state) => {
        if (!state.session) return state;
        const index = state.session.peers.findIndex((peer) => peer.clientId === clientId);
        const existingCursor = index >= 0 ? state.session.peers[index]!.cursor : null;
        const resolvedCursor =
          cursor !== null ? cursor : preserveCursorIfMessageNull ? existingCursor : null;
        const updatedPeer: PeerState = {
          clientId,
          user,
          cursor: resolvedCursor,
          activeElementId,
        };
        const peers =
          index === -1
            ? [...state.session.peers, updatedPeer]
            : state.session.peers.map((peer, peerIndex) =>
                peerIndex === index ? updatedPeer : peer,
              );
        return { session: { ...state.session, peers } };
      }),

    setLock: (entityId, lock) =>
      set((state) => {
        const locks = { ...state.locks };
        if (lock) locks[entityId] = lock;
        else delete locks[entityId];
        return { locks };
      }),

    reset: () => set({ ...INITIAL }),
  }));

export const useCollabStore = createCollabStore();
