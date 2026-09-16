import { useCollabStore } from "@/features/collaboration/store/collab.store";
import type { PeerState } from "@/features/collaboration/types";

export function usePeerOnNode(nodeId: string): PeerState | null {
  return useCollabStore((state) => {
    const peers = state.session?.peers;
    if (!peers) {
      return null;
    }
    for (const peer of peers) {
      if (peer.activeElementId === nodeId) {
        return peer;
      }
    }
    return null;
  });
}
