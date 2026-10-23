import type { StoreApi } from "zustand";
import type { Diagram, DiagramStore } from "@/features/diagram";
import { isAutomaticLayout } from "@/features/diagram/model/layout-settings";
import { getCachedCanvasSnapshot } from "@/features/diagram/utils/snapshot-cache";
import { dirtyAfterEdit } from "../layout/incrementalPlacement";
import { structuralSignature } from "../layout/structuralSignature";

/** How long a burst of edits has to rest before the automatic arrangement runs. */
export const AUTO_ARRANGE_DEBOUNCE_MS = 400;

export interface AutoArrangeWatcherOptions {
  store: StoreApi<DiagramStore>;
  /**
   * Places the elements the edits asked to place (`dirtyAfterEdit`); resolves
   * when it has been applied (or skipped).
   */
  arrange: (dirtyIds: string[]) => Promise<void> | void;
  /** Whether the canvas may arrange now: editable, not reading a flow, not comparing. */
  isEnabled: () => boolean;
  debounceMs?: number;
}

/** The fields the structure is read from, so a drag (which writes layouts only) is skipped by identity. */
interface StructureKey {
  snapshot: Diagram["snapshot"];
  versions: Diagram["versions"];
  activeVersionId: Diagram["activeVersionId"];
}

/**
 * Watches the store for structural edits the local user makes to a diagram in
 * automatic mode, and places what they touched once the edits come to rest.
 *
 * Only the touched elements are handed on (`dirtyAfterEdit`, accumulated over
 * the burst): the run places those and leaves the rest of the diagram where
 * the author has it. An edit that touches nothing placeable — a deletion, a
 * connection between two elements already in place — schedules nothing.
 *
 * What is an edit is decided by `structuralSignature` over the snapshot the
 * canvas draws. What is *not* the user's edit is decided by the store's markers:
 * undo/redo (`_lastUndoRedoAt`) and a peer's change (`_lastRemoteWriteAt`)
 * rebaseline without arranging; a run that finds the diagram already arranged
 * since it was scheduled (`_lastLayoutWriteAt`, e.g. the assistant laying out
 * what it inserted) does nothing. After its own run it rebaselines, so the
 * references a layout makes or dissolves are not taken for an edit.
 *
 * Returns the function that stops watching.
 */
export function watchAutoArrange({
  store,
  arrange,
  isEnabled,
  debounceMs = AUTO_ARRANGE_DEBOUNCE_MS,
}: AutoArrangeWatcherOptions): () => void {
  let diagramId: string | null = null;
  let key: StructureKey | null = null;
  let baseline: string | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let layoutWriteAtSchedule = 0;
  let running = false;
  type Structure = Parameters<typeof dirtyAfterEdit>[0];
  let structure: Structure | null = null;
  /** The structure read by the last `signatureOf` that recomputed. */
  let pendingStructure: Structure | null = null;
  const dirty = new Set<string>();

  const cancel = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
  };

  const signatureOf = (diagram: Diagram): string => {
    const next: StructureKey = {
      snapshot: diagram.snapshot,
      versions: diagram.versions,
      activeVersionId: diagram.activeVersionId,
    };
    if (
      key !== null &&
      baseline !== null &&
      key.snapshot === next.snapshot &&
      key.versions === next.versions &&
      key.activeVersionId === next.activeVersionId
    ) {
      return baseline;
    }
    key = next;
    const resolved = getCachedCanvasSnapshot(diagram);
    pendingStructure = { components: resolved.components, connections: resolved.connections };
    return structuralSignature(resolved);
  };

  const rebaseline = (state: DiagramStore): void => {
    diagramId = state.activeDiagramId;
    const diagram = diagramId ? state.diagrams[diagramId] : undefined;
    key = null;
    baseline = null;
    baseline = diagram ? signatureOf(diagram) : null;
    structure = diagram ? pendingStructure : null;
    dirty.clear();
  };

  const run = async (): Promise<void> => {
    timer = null;
    const ids = [...dirty];
    dirty.clear();
    const state = store.getState();
    const diagram = state.activeDiagramId ? state.diagrams[state.activeDiagramId] : undefined;
    if (!diagram || !isAutomaticLayout(diagram.layoutSettings) || !isEnabled()) return;
    // Something arranged the diagram after the edit already; arranging again
    // would only add a second animation to the same result.
    if (state._lastLayoutWriteAt !== layoutWriteAtSchedule) return;
    if (ids.length === 0) return;
    running = true;
    try {
      await arrange(ids);
    } finally {
      running = false;
      rebaseline(store.getState());
    }
  };

  rebaseline(store.getState());

  const unsubscribe = store.subscribe((state, previous) => {
    if (state.activeDiagramId !== diagramId) {
      cancel();
      rebaseline(state);
      return;
    }
    const diagram = diagramId ? state.diagrams[diagramId] : undefined;
    if (!diagram) return;
    if (!isAutomaticLayout(diagram.layoutSettings) || !isEnabled()) {
      cancel();
      rebaseline(state);
      return;
    }

    const signature = signatureOf(diagram);
    if (signature === baseline) return;
    baseline = signature;
    const before = structure;
    structure = pendingStructure;

    if (running) return;
    // Not the user's edit: undo/redo puts back a state that was already
    // arranged (and arranging it would break redo), a peer's change is
    // arranged by the peer, and a change written together with positions is an
    // arrangement — the references a layout makes or dissolves. That last rule
    // also skips the one structural edit that writes positions itself, an
    // Alt-drag shared reference: it is arranged by the next edit instead.
    if (
      state._lastUndoRedoAt !== previous._lastUndoRedoAt ||
      state._lastRemoteWriteAt !== previous._lastRemoteWriteAt ||
      state._lastLayoutWriteAt !== previous._lastLayoutWriteAt
    ) {
      cancel();
      dirty.clear();
      return;
    }

    if (before && structure) {
      for (const id of dirtyAfterEdit(before, structure)) dirty.add(id);
    }
    if (dirty.size === 0) return;
    cancel();
    layoutWriteAtSchedule = state._lastLayoutWriteAt;
    timer = setTimeout(() => void run(), debounceMs);
  });

  return () => {
    cancel();
    unsubscribe();
  };
}
