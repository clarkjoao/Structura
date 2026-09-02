import { current, isDraft, type Draft } from "immer";
import type { AppState, DiagramSnapshot } from "../store.types";
import {
  HISTORY_COALESCE_MS,
  MAX_HISTORY_STEPS,
  STRUCTURAL_MUTATION_MARKER,
  UNDO_REDO_COOLDOWN_MS,
} from "../store.constants";
import type { HistoryMutationKind } from "../store.constants";
import { getActiveDiagram } from "../helpers/get-active-diagram";

export type { HistoryMutationKind } from "../store.constants";

/** Convert a draft or plain value to its plain snapshot. O(1) — Immer structural sharing. */
function toPlain<T>(v: T): T {
  return isDraft(v) ? current(v as Draft<T>) : v;
}

/**
 * A checkpoint that is always taken, whatever just happened.
 *
 * For an explicit boundary — the start of an editing session — rather than an
 * edit: the cooldown and the coalescing window exist to stop *edits* from
 * piling up checkpoints, and a boundary that skipped itself because the user
 * had just pressed Ctrl+Z would leave that session with nothing to go back to.
 *
 * Returns whether a checkpoint was recorded, so a caller can find it again.
 */
export function pushHistoryCheckpoint(state: AppState): boolean {
  const d = getActiveDiagram(state);
  if (!d) return false;
  state.past.push({
    diagramId: d.id,
    timestamp: Date.now(),
    snapshot: toPlain(d.snapshot),
    nodeLayouts: toPlain(d.nodeLayouts),
    edgeLayouts: toPlain(d.edgeLayouts),
  });
  if (state.past.length > MAX_HISTORY_STEPS) state.past.shift();
  state.future = [];
  return true;
}

/** Snapshot clone for undo — O(n) per checkpoint; coalescing limits frequency (see HISTORY_COALESCE_MS). */
export function pushHistory(state: AppState, mutationType: HistoryMutationKind = "soft"): void {
  const d = getActiveDiagram(state);
  if (!d) return;
  if (Date.now() - state._lastUndoRedoAt < UNDO_REDO_COOLDOWN_MS) return;
  if (mutationType !== STRUCTURAL_MUTATION_MARKER) {
    const last = state.past[state.past.length - 1];
    if (last?.diagramId === d.id && Date.now() - last.timestamp < HISTORY_COALESCE_MS) return;
  }
  pushHistoryCheckpoint(state);
}

export const historySlice = (
  set: (fn: (state: AppState) => void) => void,
  _get: () => AppState,
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

      // Capture current state before mutating — no structuredClone needed.
      const currentSnapshot = d.snapshot;
      const currentNodeLayouts = d.nodeLayouts;
      const currentEdgeLayouts = d.edgeLayouts;

      state.past.splice(entryIndex, 1);
      state.future.push({
        diagramId: d.id,
        snapshot: currentSnapshot,
        nodeLayouts: currentNodeLayouts,
        edgeLayouts: currentEdgeLayouts,
        timestamp: Date.now(),
      } as DiagramSnapshot);
      d.snapshot = entry.snapshot;
      d.nodeLayouts = entry.nodeLayouts;
      d.edgeLayouts = entry.edgeLayouts;
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

      // Capture current state before mutating — no structuredClone needed.
      const currentSnapshot = d.snapshot;
      const currentNodeLayouts = d.nodeLayouts;
      const currentEdgeLayouts = d.edgeLayouts;

      state.future.splice(entryIndex, 1);
      state.past.push({
        diagramId: d.id,
        snapshot: currentSnapshot,
        nodeLayouts: currentNodeLayouts,
        edgeLayouts: currentEdgeLayouts,
        timestamp: Date.now(),
      } as DiagramSnapshot);
      d.snapshot = entry.snapshot;
      d.nodeLayouts = entry.nodeLayouts;
      d.edgeLayouts = entry.edgeLayouts;
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
