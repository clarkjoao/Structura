import { create } from "zustand";
import type {
  CollabEndReason,
  CollabSession,
  CollabStatus,
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
  /** The peer (client id) whose cursor this canvas follows, or null. */
  following: string | null;

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
  setLock: (entityId: string, lock: ElementLock | null) => void;
  /** Several lock changes in one update (`null` frees); a multi-selection moves many at once. */
  applyLocks: (changes: ReadonlyMap<string, ElementLock | null>) => void;
  /** Several peers' cursors in one update; peers not in the session are ignored. */
  applyCursors: (
    entries: ReadonlyArray<{
      clientId: string;
      cursor: { x: number; y: number } | null;
      activeElementId: string | null;
    }>,
  ) => void;
  setFollowing: (clientId: string | null) => void;
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
  following: null,
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
          following: state.following === clientId ? null : state.following,
          session: {
            ...state.session,
            peers: state.session.peers.filter((peer) => peer.clientId !== clientId),
          },
        };
      }),

    setLock: (entityId, lock) =>
      set((state) => {
        const locks = { ...state.locks };
        if (lock) locks[entityId] = lock;
        else delete locks[entityId];
        return { locks };
      }),

    applyLocks: (changes) =>
      set((state) => {
        if (changes.size === 0) return state;
        const locks = { ...state.locks };
        for (const [entityId, lock] of changes) {
          if (lock) locks[entityId] = lock;
          else delete locks[entityId];
        }
        return { locks };
      }),

    applyCursors: (entries) =>
      set((state) => {
        if (!state.session || entries.length === 0) return state;
        const byId = new Map(entries.map((entry) => [entry.clientId, entry]));
        let changed = false;
        const peers = state.session.peers.map((peer) => {
          const entry = byId.get(peer.clientId);
          if (!entry) return peer;
          changed = true;
          return { ...peer, cursor: entry.cursor, activeElementId: entry.activeElementId };
        });
        return changed ? { session: { ...state.session, peers } } : state;
      }),

    setFollowing: (following) => set({ following }),

    reset: () => set({ ...INITIAL }),
  }));

export const useCollabStore = createCollabStore();
