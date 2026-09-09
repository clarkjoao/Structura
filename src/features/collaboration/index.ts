// ─── Components ─────────────────────────────────────────────────────────────────
export { CollabProvider, useCollab } from "./components/CollabProvider";
export { CollabEditingWarning } from "./components/CollabEditingWarning";
export { CollabCursors } from "./components/CollabCursors";
export { CollabToolbar } from "./components/CollabToolbar";
export { CollabStartModal } from "./components/CollabStartModal";
export { CollabRoom } from "./components/CollabRoom";

// ─── Hooks ─────────────────────────────────────────────────────────────────────
export { useCollabHighlight } from "./hooks/useCollabHighlight";
export { useCollabStore } from "./store/collab.store";

// ─── Types ─────────────────────────────────────────────────────────────────────
export type { PeerState } from "./types";

// Internal — use relative imports within the feature:
//   CollabJoinModal, CollabSessionClosedModal → ./components/
//   CollabStatusIndicator → ./components/
//   remoteLayoutUpdates → ./hooks/useCollabStoreSync
//   CollabElementHighlight → ./hooks/useCollabHighlight
