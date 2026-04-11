import { current, isDraft } from "immer";
import type { AppState, DiagramSnapshot } from "../store.types";
import {
  HISTORY_COALESCE_MS,
  MAX_HISTORY_STEPS,
  STRUCTURAL_MUTATION_MARKER,
  UNDO_REDO_COOLDOWN_MS,
} from "../store.constants";
import type { HistoryMutationKind } from "../store.constants";
import { getActiveDiagram } from "./get-active-diagram";

export type { HistoryMutationKind } from "../store.constants";

/**
 * Deep snapshot copy for undo/redo. Uses `structuredClone` (faster than JSON for large diagrams;
 * preserves Date, etc.). Inside Immer `set()` callbacks, snapshots are drafts — `current()` unwraps
 * them before cloning; plain values (e.g. tests, finished state) are cloned as-is.
 */
export function deepClone<T>(v: T): T {
  const plain = isDraft(v) ? current(v) : v;
  return structuredClone(plain);
}

export function pushHistory(
  state: AppState,
  mutationType: HistoryMutationKind = "soft",
): void {
  const d = getActiveDiagram(state);
  if (!d) return;
  if (Date.now() - state._lastUndoRedoAt < UNDO_REDO_COOLDOWN_MS) return;
  if (mutationType !== STRUCTURAL_MUTATION_MARKER) {
    const last = state.past[state.past.length - 1];
    if (last?.diagramId === d.id && Date.now() - last.timestamp < HISTORY_COALESCE_MS) return;
  }
  state.past.push({
    diagramId: d.id,
    timestamp: Date.now(),
    snapshot: deepClone(d.snapshot),
    nodeLayouts: deepClone(d.nodeLayouts),
  });
  if (state.past.length > MAX_HISTORY_STEPS) state.past.shift();
  state.future = [];
}

export const historySlice = 
(set: (fn: (state: AppState) => void) => void,
    get: () => AppState,
) => ({
    undo: () => { 
      set((state) => {
        const entry = state.past.pop();
        if (!entry) return;
        const d = state.diagrams[entry.diagramId];
        if (!d) return;
        state.future.push({
          diagramId: d.id,
          snapshot: deepClone(d.snapshot),
          nodeLayouts: deepClone(d.nodeLayouts),
          timestamp: Date.now(),
        } as DiagramSnapshot);
        d.snapshot = entry.snapshot;
        d.nodeLayouts = entry.nodeLayouts;
        state._lastUndoRedoAt = Date.now();
      });
    },

    redo: () => {
      set((state) => {
        const entry = state.future.pop();
        if (!entry) return;
        const d = state.diagrams[entry.diagramId];
        if (!d) return;
        state.past.push({
          diagramId: d.id,
          snapshot: deepClone(d.snapshot),
          nodeLayouts: deepClone(d.nodeLayouts),
          timestamp: Date.now(),
        } as DiagramSnapshot);
        d.snapshot = entry.snapshot;
        d.nodeLayouts = entry.nodeLayouts;
        state._lastUndoRedoAt = Date.now();
      });
    },
  });
