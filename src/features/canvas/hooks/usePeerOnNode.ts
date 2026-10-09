import { useCollabStore } from "@/features/collaboration/store/collab.store";
import type { PeerState } from "@/features/collaboration/types";

/**
 * The peer to show on a node: whoever holds its soft lock (moving or retyping it) first, else
 * whoever has it selected. Returns the store's own object, so the selector stays stable.
 */
export function usePeerOnNode(nodeId: string): PeerState | null {
  return useCollabStore((state) => {
    const peers = state.session?.peers;
    if (!peers) {
      return null;
    }
    const lock = state.locks[nodeId];
    if (lock) {
      const holder = peers.find((peer) => peer.clientId === lock.holder);
      if (holder) return holder;
    }
    for (const peer of peers) {
      if (peer.activeElementId === nodeId) {
        return peer;
      }
    }
    return null;
  });
}

/** Whether a peer holds the node's soft lock, so it cannot be dragged or retyped here. */
export function useIsNodeLocked(nodeId: string): boolean {
  return useCollabStore((state) => state.locks[nodeId] !== undefined);
}
