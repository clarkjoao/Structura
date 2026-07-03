import type { Diagram } from "@/features/diagram";
// Leaf import: this module is loaded at app boot; the barrel would drag the whole
// diagram feature into the entry chunk (see AGENTS.md "Known sharp edges").
import { useDiagramStore } from "@/features/diagram/store/diagram.store";

/**
 * Host-side source for `StructuraPlugin.onDiagramChange`: watches committed diagram-store
 * state by reference and notifies on a trailing debounce, so plugins observe consistent
 * states, not intermediate drag frames.
 */

const DIAGRAM_CHANGE_DEBOUNCE_MS = 300;

type DiagramChangeCallback = (diagramId: string) => void;

const callbacks = new Set<DiagramChangeCallback>();
const pendingDiagramIds = new Set<string>();
let previousDiagrams: Record<string, Diagram> | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let watching = false;

function flush(): void {
  flushTimer = null;
  const diagramIds = [...pendingDiagramIds];
  pendingDiagramIds.clear();
  for (const diagramId of diagramIds) {
    for (const callback of [...callbacks]) {
      try {
        callback(diagramId);
      } catch (error) {
        console.error("[plugins] onDiagramChange callback threw:", error);
      }
    }
  }
}

function ensureWatching(): void {
  if (watching) return;
  watching = true;
  previousDiagrams = useDiagramStore.getState().diagrams;
  useDiagramStore.subscribe((state) => {
    const nextDiagrams = state.diagrams;
    if (previousDiagrams === nextDiagrams) return;
    for (const [id, diagram] of Object.entries(nextDiagrams)) {
      if (previousDiagrams?.[id] !== diagram) pendingDiagramIds.add(id);
    }
    previousDiagrams = nextDiagrams;
    if (pendingDiagramIds.size > 0 && flushTimer === null) {
      flushTimer = setTimeout(flush, DIAGRAM_CHANGE_DEBOUNCE_MS);
    }
  });
}

export function subscribeDiagramChange(callback: DiagramChangeCallback): () => void {
  ensureWatching();
  callbacks.add(callback);
  return () => {
    callbacks.delete(callback);
  };
}
