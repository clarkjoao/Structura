import { create } from "zustand";
import type { CollabSession, CollabStatus, CollabUser, PeerState } from "../types";

export interface CollabStoreState {
  session: CollabSession | null;
  status: CollabStatus;
  isReady: boolean;
  sessionClosedByHost: boolean;
  hostDisconnected: boolean;
  roomFullReason: string | null;
  participantCount: number;
  maxParticipants: number;

  setSession: (session: CollabSession | null) => void;
  setStatus: (status: CollabStatus) => void;
  setIsReady: (value: boolean) => void;
  setSessionClosedByHost: (value: boolean) => void;
  setHostDisconnected: (value: boolean) => void;
  setRoomFullReason: (reason: string | null) => void;
  setParticipantCount: (count: number, max: number) => void;
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
  roomFullReason: null,
  participantCount: 0,
  maxParticipants: 15,

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

  setSessionClosedByHost: (sessionClosedByHost) => set({ sessionClosedByHost }),

  setHostDisconnected: (hostDisconnected) => set({ hostDisconnected }),

  setRoomFullReason: (roomFullReason) => set({ roomFullReason }),

  setParticipantCount: (count, max) => set({ participantCount: count, maxParticipants: max }),

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
}));
