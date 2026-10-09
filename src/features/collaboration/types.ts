export interface CollabUser {
  id: string;
  name: string;
  color: string;
}

export type CollabStatus =
  "idle" | "connecting" | "connected" | "reconnecting" | "disconnected" | "closed";

export interface PeerState {
  clientId: string;
  user: CollabUser;
  cursor: { x: number; y: number } | null;
  activeElementId: string | null;
}

export interface CollabSession {
  roomId: string;
  isHost: boolean;
  localUser: CollabUser;
  peers: PeerState[];
  status: CollabStatus;
}

/** Why a session ended for this participant; drives the closing dialog. */
export type CollabEndReason =
  | "host_closed"
  | "host_timeout"
  | "room_unknown"
  | "room_full"
  | "protocol_mismatch"
  | "too_large"
  | "invalid_seed"
  | "unauthorized"
  | "unreachable";

/** A soft lock another participant holds on an element. */
export interface ElementLock {
  holder: string;
  expiresAt: number;
}
