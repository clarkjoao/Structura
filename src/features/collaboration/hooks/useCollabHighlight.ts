import { useCollab } from "../components/CollabProvider";
import { useCollabStore } from "../store/collab.store";
import type { CollabUser } from "../types";

export interface CollabElementHighlight {
  color: string;
  userName: string;
  /** The peer holds the element's soft lock (moving or retyping it). */
  locked: boolean;
}

/** Who to show on an element: its lock holder first, else a peer that has it selected. */
export function useCollabHighlight(elementId: string | null): CollabElementHighlight | null {
  const { editingComponents } = useCollab();
  const holder = useCollabStore((state) => {
    if (!elementId) return null;
    const lock = state.locks[elementId];
    if (!lock) return null;
    return state.session?.peers.find((peer) => peer.clientId === lock.holder)?.user ?? null;
  });
  if (!elementId) return null;
  if (holder) return { color: holder.color, userName: holder.name, locked: true };
  const user: CollabUser | undefined = editingComponents.get(elementId);
  if (!user) return null;
  return { color: user.color, userName: user.name, locked: false };
}
