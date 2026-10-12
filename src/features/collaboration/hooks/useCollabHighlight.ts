import { useCollabStore } from "../store/collab.store";
import type { CollabUser } from "../types";

export interface CollabElementHighlight {
  color: string;
  userName: string;
  /** The peer holds the element's soft lock (moving or retyping it). */
  locked: boolean;
}

/**
 * Who to show on an element: its lock holder first, else a peer that has it selected.
 *
 * Every canvas element calls this, so it reads the store through selectors that return a peer's
 * `user` — one object for the whole session — and re-renders only when the answer for this
 * element changes, never because some other peer moved a cursor or took another lock.
 */
export function useCollabHighlight(elementId: string | null): CollabElementHighlight | null {
  const holder = useCollabStore((state): CollabUser | null => {
    if (!elementId) return null;
    const lock = state.locks[elementId];
    if (!lock) return null;
    return state.session?.peers.find((peer) => peer.clientId === lock.holder)?.user ?? null;
  });
  const editor = useCollabStore((state): CollabUser | null => {
    if (!elementId) return null;
    return state.session?.peers.find((peer) => peer.activeElementId === elementId)?.user ?? null;
  });
  if (holder) return { color: holder.color, userName: holder.name, locked: true };
  if (!editor) return null;
  return { color: editor.color, userName: editor.name, locked: false };
}
