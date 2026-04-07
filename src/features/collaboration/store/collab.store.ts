import { create } from "zustand";
import type { CollabSession, CollabStatus, CollabUser, PeerState } from "../types";

export interface CollabStoreState {
  session: CollabSession | null;
  status: CollabStatus;
  isReady: boolean;
  sessionClosedByHost: boolean;
  hostDisconnected: boolean;

  setSession: (session: CollabSession | null) => void;
  setStatus: (status: CollabStatus) => void;
  setIsReady: (value: boolean) => void;
  setSessionClosedByHost: (value: boolean) => void;
  setHostDisconnected: (value: boolean) => void;
  upsertPeer: (peer: PeerState) => void;
  removePeer: (clientId: string) => void;
  applyPeerCursorPayload: (input: {
    clientId: string;
    user: CollabUser;
    cursor: { x: number; y: number } | null;
    activeElementId: string | null;
    preserveCursorIfMessageNull: boolean;
  }) => void;
}

export const useCollabStore = create<CollabStoreState>((set) => ({
  session: null,
  status: "idle",
  isReady: false,
  sessionClosedByHost: false,
  hostDisconnected: false,

  setSession: (session) =>
    set((state) => ({
      session,
      ...(session ? { status: session.status } : {}),
    })),

  setStatus: (status) =>
    set((state) => ({
      status,
      session: state.session ? { ...state.session, status } : null,
    })),

  setIsReady: (isReady) => set({ isReady }),

  setSessionClosedByHost: (sessionClosedByHost) => set({ sessionClosedByHost }),

  setHostDisconnected: (hostDisconnected) => set({ hostDisconnected }),

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
        cursor !== null
          ? cursor
          : preserveCursorIfMessageNull
            ? existingCursor
            : null;
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
}));
