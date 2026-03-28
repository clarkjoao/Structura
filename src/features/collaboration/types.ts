export interface CollabUser {
  id: string;
  name: string;
  color: string;
}

export type CollabStatus =
  | "idle"
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected"
  | "closed";

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
