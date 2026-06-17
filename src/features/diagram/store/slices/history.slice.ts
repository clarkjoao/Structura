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


export function deepClone<T>(v: T): T {
  const plain = isDraft(v) ? current(v) : v;
  return structuredClone(plain);
}

/** Snapshot clone for undo — O(n) per checkpoint; coalescing limits frequency (see HISTORY_COALESCE_MS). */
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
        const activeId = state.activeDiagramId;
        if (!activeId) return;

        /** Linear scan for last entry for the active diagram (past is global, bounded by MAX_HISTORY_STEPS). */
        let entryIndex = -1;
        for (let i = state.past.length - 1; i >= 0; i--) {
          if (state.past[i].diagramId === activeId) {
            entryIndex = i;
            break;
          }
        }
        if (entryIndex === -1) return;

        const entry = state.past[entryIndex];
        if (!entry) return;
        const d = state.diagrams[activeId];
        if (!d) return;
        state.past.splice(entryIndex, 1);
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
        const activeId = state.activeDiagramId;
        if (!activeId) return;

        let entryIndex = -1;
        for (let i = state.future.length - 1; i >= 0; i--) {
          if (state.future[i].diagramId === activeId) {
            entryIndex = i;
            break;
          }
        }
        if (entryIndex === -1) return;

        const entry = state.future[entryIndex];
        if (!entry) return;
        const d = state.diagrams[activeId];
        if (!d) return;
        state.future.splice(entryIndex, 1);
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

    /**
     * Open a structural undo checkpoint imperatively, outside of any mutating
     * action. Lets non-React callers (e.g. the LLM store) integrate with undo
     * without reaching into `pushHistory`/`STRUCTURAL_MUTATION_MARKER` directly.
     */
    pushHistoryBoundary: () => {
      set((state) => {
        pushHistory(state, STRUCTURAL_MUTATION_MARKER);
      });
    },
  });
