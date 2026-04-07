/** File-system sync debounce after store updates. */
export const VIEWPORT_DEBOUNCE_MS = 800;
/** Maximum number of history steps to store. */
export const MAX_HISTORY_STEPS = 50;
/** Time to wait before coalescing history entries. */
export const HISTORY_COALESCE_MS = 1000;
/** Structural mutations never coalesce — always create their own checkpoint. */
export const STRUCTURAL_MUTATION_MARKER = "structural" as const;
export type HistoryMutationKind = "soft" | "structural";
/** Time to wait before allowing a new undo/redo operation after a previous one. */
export const UNDO_REDO_COOLDOWN_MS = 50;
