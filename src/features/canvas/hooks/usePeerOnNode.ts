import { useCollabStore } from "@/features/collaboration/store/collab.store";
import type { CollabUser } from "@/features/collaboration/types";

/**
 * The peer to show on a node: whoever holds its soft lock (moving or retyping it) first, else
 * whoever has it selected. Returns that peer's user — the same object for the whole session —
 * and not the peer, which is replaced on every cursor frame and would re-render the node with it.
 */
export function usePeerOnNode(nodeId: string): CollabUser | null {
  return useCollabStore((state) => {
    const peers = state.session?.peers;
    if (!peers) {
      return null;
    }
    const lock = state.locks[nodeId];
    if (lock) {
      const holder = peers.find((peer) => peer.clientId === lock.holder);
      if (holder) return holder.user;
    }
    for (const peer of peers) {
      if (peer.activeElementId === nodeId) {
        return peer.user;
      }
    }
    return null;
  });
}

/** Whether a peer holds the node's soft lock, so it cannot be dragged or retyped here. */
export function useIsNodeLocked(nodeId: string): boolean {
  return useCollabStore((state) => state.locks[nodeId] !== undefined);
}
