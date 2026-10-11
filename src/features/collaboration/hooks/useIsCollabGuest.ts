import { useCollabStore } from "../store/collab.store";

/**
 * Whether this participant is a guest in a live session. A selector, not `useCollab()`: the
 * context changes with every peer event, and a canvas node reading it re-rendered with each one.
 */
export function useIsCollabGuest(): boolean {
  return useCollabStore((state) => state.session !== null && !state.session.isHost);
}
