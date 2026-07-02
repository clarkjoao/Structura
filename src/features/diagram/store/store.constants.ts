export const VIEWPORT_DEBOUNCE_MS = 800;

export const MAX_HISTORY_STEPS = 30;

export const HISTORY_COALESCE_MS = 1500;

export const STRUCTURAL_MUTATION_MARKER = "structural" as const;
export type HistoryMutationKind = "soft" | "structural";

export const UNDO_REDO_COOLDOWN_MS = 50;
