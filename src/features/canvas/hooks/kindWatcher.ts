import type { StoreApi } from "zustand";
import type { Diagram, DiagramStore } from "@/features/diagram";
import { getCachedCanvasSnapshot } from "@/features/diagram/utils/snapshot-cache";
import type { KindEdit } from "@/features/diagram/model/kind-edit.types";
import { resolveKindPolicy } from "@/features/diagram-kinds/policy";
import type { DiagramKindDescriptor } from "@/features/diagram-kinds/kind.types";
import { structuralSignature } from "../layout/structuralSignature";

/** A kind's own editor waits only long enough to coalesce a burst of keystrokes. */
export const KIND_WATCH_DEBOUNCE_MS = 50;

export interface KindWatcherOptions {
  store: StoreApi<DiagramStore>;
  /** The derivation of `descriptor` over `diagram`, or null when nothing changes. */
  derive: (diagram: Diagram, descriptor: DiagramKindDescriptor) => KindEdit | null;
  /** Arranges the diagram and writes the positions without a history entry. */
  arrange: (diagram: Diagram, descriptor: DiagramKindDescriptor) => Promise<void> | void;
  /** Whether the canvas may run the kind now: editable, not reading a flow, not comparing. */
  isEnabled: () => boolean;
  debounceMs?: number;
}

/** The kind data key the watcher records the arranged structure under. */
export const ARRANGED_SIGNATURE_KEY = "arrangedSignature";

interface Seen {
  diagramId: string | null;
  policy: string;
  snapshot: unknown;
  versions: unknown;
  activeVersionId: unknown;
  signature: string | null;
}

function arrangeSignature(diagram: Diagram, descriptor: DiagramKindDescriptor): string {
  const structure = structuralSignature(getCachedCanvasSnapshot(diagram));
  const extra = descriptor.arrangeKey?.(diagram) ?? "";
  return `${structure}§${extra}`;
}

function storedSignature(diagram: Diagram): string | undefined {
  const value = diagram.kindData?.[ARRANGED_SIGNATURE_KEY];
  return typeof value === "string" ? value : undefined;
}

/**
 * Runs a diagram kind's derivation and arrangement after the edits made to the
 * active diagram while it is in its kind's editor (ADR-0014, design D4).
 *
 * Every writer is covered by watching the store rather than calling a hook from
 * each one: the author's edits, a plugin's `applyChanges`, an assistant patch,
 * a paste, an edit inside a Version. What is not an edit only rebaselines:
 * undo/redo (it puts back a state that was already derived and arranged) and a
 * peer's change (the peer's editor ran the kind). The run writes without
 * history, so the edit's own checkpoint — taken before it — holds the old
 * structure, flow and positions, and one undo reverts all three.
 *
 * Derivation runs after any change to the diagram's content (a label can be a
 * branch label); arrangement only when the structure, or what the kind's
 * `arrangeKey` reads, changed. On opening a diagram, and on returning it from
 * freehand to its kind, a structure that was not arranged yet is arranged once.
 *
 * Returns the function that stops watching.
 */
export function watchDiagramKind({
  store,
  derive,
  arrange,
  isEnabled,
  debounceMs = KIND_WATCH_DEBOUNCE_MS,
}: KindWatcherOptions): () => void {
  let seen: Seen = {
    diagramId: null,
    policy: "",
    snapshot: null,
    versions: null,
    activeVersionId: null,
    signature: null,
  };
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let pendingArrange = false;

  const cancel = (): void => {
    if (timer !== null) clearTimeout(timer);
    timer = null;
    pendingArrange = false;
  };

  const look = (state: DiagramStore): Seen => {
    const diagramId = state.activeDiagramId;
    const diagram = diagramId ? state.diagrams[diagramId] : undefined;
    const policy = resolveKindPolicy(diagram);
    const descriptor = policy.type === "kind" ? policy.descriptor : null;
    const sameContent =
      diagram !== undefined &&
      seen.diagramId === diagramId &&
      seen.snapshot === diagram.snapshot &&
      seen.versions === diagram.versions &&
      seen.activeVersionId === diagram.activeVersionId;
    return {
      diagramId,
      policy: policy.type === "kind" ? `kind:${policy.descriptor.id}` : policy.type,
      snapshot: diagram?.snapshot ?? null,
      versions: diagram?.versions ?? null,
      activeVersionId: diagram?.activeVersionId ?? null,
      signature:
        diagram && descriptor
          ? sameContent && seen.signature !== null && seen.policy === `kind:${descriptor.id}`
            ? seen.signature
            : arrangeSignature(diagram, descriptor)
          : null,
    };
  };

  const schedule = (arrangeToo: boolean): void => {
    pendingArrange ||= arrangeToo;
    if (timer !== null) clearTimeout(timer);
    timer = setTimeout(() => void run(), debounceMs);
  };

  const run = async (): Promise<void> => {
    timer = null;
    const withArrange = pendingArrange;
    pendingArrange = false;
    if (!isEnabled()) return;
    const state = store.getState();
    const diagramId = state.activeDiagramId;
    const diagram = diagramId ? state.diagrams[diagramId] : undefined;
    const policy = resolveKindPolicy(diagram);
    if (!diagram || policy.type !== "kind") return;
    const descriptor = policy.descriptor;

    running = true;
    try {
      const derived = derive(diagram, descriptor);
      if (derived)
        store.getState().applyKindEdit(derived, { diagramId: diagram.id, history: false });
      if (withArrange) {
        const current = store.getState().diagrams[diagram.id];
        if (current) await arrange(current, descriptor);
        const after = store.getState().diagrams[diagram.id];
        if (after && store.getState().activeDiagramId === diagram.id) {
          const signature = arrangeSignature(after, descriptor);
          if (storedSignature(after) !== signature) {
            store
              .getState()
              .applyKindEdit(
                { kindData: { ...(after.kindData ?? {}), [ARRANGED_SIGNATURE_KEY]: signature } },
                { diagramId: after.id, history: false },
              );
          }
        }
      }
    } finally {
      running = false;
      seen = look(store.getState());
    }
  };

  const onState = (state: DiagramStore, previous: DiagramStore | null): void => {
    const next = look(state);
    const before = seen;
    seen = next;

    if (next.diagramId !== before.diagramId || next.policy !== before.policy) {
      cancel();
      // Opening a kind diagram, or returning one to its kind: arrange a structure that was not
      // arranged yet (written while closed, by a plugin, in freehand mode, by an older build).
      if (next.signature !== null) {
        const diagram = state.diagrams[next.diagramId!];
        const stale = diagram ? storedSignature(diagram) !== next.signature : false;
        const returned = before.diagramId === next.diagramId && before.policy !== next.policy;
        if (stale || returned) schedule(true);
      }
      return;
    }
    if (next.signature === null) return;
    if (running) return;
    if (
      previous &&
      (state._lastUndoRedoAt !== previous._lastUndoRedoAt ||
        state._lastRemoteWriteAt !== previous._lastRemoteWriteAt)
    ) {
      cancel();
      return;
    }
    const contentChanged =
      next.snapshot !== before.snapshot ||
      next.versions !== before.versions ||
      next.activeVersionId !== before.activeVersionId;
    if (!contentChanged) return;
    schedule(next.signature !== before.signature);
  };

  onState(store.getState(), null);
  const unsubscribe = store.subscribe((state, previous) => onState(state, previous));

  return () => {
    cancel();
    unsubscribe();
  };
}
