import { createContext, useContext } from "react";
import type { CollabSession as CollabSessionInfo, CollabStatus } from "../types";

export interface CollabContextValue {
  /**
   * The session as the UI around the canvas needs it. Peers' cursor positions are left out of
   * its identity — they change many times a second per person, and every consumer of this
   * context would re-render with them. Read live cursors from `useCollabStore`.
   */
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
  peerLimitReached: boolean;
  /** Ask for the soft locks on elements for a drag or text edit (see collab-presence). */
  lockElements: (ids: string[]) => void;
  renewElementLocks: (ids: string[]) => void;
  unlockElements: (ids: string[]) => void;
}

export const CollabContext = createContext<CollabContextValue>({
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
  peerLimitReached: false,
  lockElements: () => {},
  renewElementLocks: () => {},
  unlockElements: () => {},
});

export function useCollab() {
  return useContext(CollabContext);
}
