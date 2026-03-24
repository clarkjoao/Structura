export interface CollabUser {
  id: string;
  name: string;
  color: string;
}

export interface PeerAwareness {
  user: CollabUser;
  cursor?: { x: number; y: number } | null;
  viewport?: { x: number; y: number; zoom: number };
  selectedNodeId?: string | null;
}

export interface CollabSession {
  roomId: string;
  isHost: boolean;
  localUser: CollabUser;
  peers: Map<number, PeerAwareness>;
  isReady: boolean;
}
