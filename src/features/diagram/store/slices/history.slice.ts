import type { AppState, DiagramSnapshot } from "../store.types";
import {
  HISTORY_COALESCE_MS,
  MAX_HISTORY_STEPS,
  UNDO_REDO_COOLDOWN_MS,
} from "../store.constants";

export function deepClone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v));
}

export function pushHistory(state: AppState) {
  const d = state.diagrams[state.activeDiagramId!];
  if (!d) return;
  if (Date.now() - state._lastUndoRedoAt < UNDO_REDO_COOLDOWN_MS) return;
  const last = state.past[state.past.length - 1];
  if (last?.diagramId === d.id && Date.now() - last.timestamp < HISTORY_COALESCE_MS) return;
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
