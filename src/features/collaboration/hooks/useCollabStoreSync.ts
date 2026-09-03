import { useCallback, useEffect, useRef, type RefObject } from "react";
import { useDiagramStore } from "@/features/diagram";
import type { CollabPatch, CollabSnapshot } from "./useCollab";

export const remoteLayoutUpdates = new Set<string>();

interface TrackedDiagramState {
  diagramName: string;
  domain?: string;
  description?: string;
  components: Record<string, unknown>;
  connections: Record<string, unknown>;
  flows: Record<string, unknown>;
  iconLibrary: Record<string, unknown>;
  nodeLayouts: Record<string, unknown>;
  edgeLayouts: Record<string, unknown>;
  scenes: Record<string, unknown>;
  activeSceneId: string | null;
  compareSceneId: string | null;
}

interface UseCollabStoreSyncParams {
  diagramId: string | null;
  sendPatchRef: RefObject<(patch: CollabPatch) => void>;
}

interface UseCollabStoreSyncReturn {
  getSnapshot: () => CollabSnapshot | null;
  onPatch: (patch: CollabPatch) => void;
}

function hasOwn<T extends object>(obj: T, key: keyof T): boolean {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

/**
 * Merge an incoming per-entity delta into a collection, mirroring the server's
 * applyPatch: entries are merged one level and a `null` entry removes that
 * entity. Returns the original reference when there is nothing to apply, so
 * untouched collections keep their identity and don't invalidate memoisation.
 */
function mergeCollection<T extends Record<string, unknown>>(
  existing: T | undefined,
  delta: unknown,
): T {
  const base = (existing ?? {}) as T;
  if (!delta || typeof delta !== "object" || Array.isArray(delta)) return base;

  const entries = Object.entries(delta as Record<string, unknown>);
  if (entries.length === 0) return base;

  const next: Record<string, unknown> = { ...base };
  for (const [entityId, value] of entries) {
    if (value === null) {
      delete next[entityId];
    } else {
      next[entityId] = value;
    }
  }
  return next as T;
}

function pickTrackedState(diagramId: string | null): TrackedDiagramState | null {
  if (!diagramId) return null;
  const state = useDiagramStore.getState();
  const diagram = state.diagrams[diagramId];
  if (!diagram) return null;

  return {
    diagramName: diagram.name,
    domain: diagram.domain,
    description: diagram.description,
    components: diagram.snapshot.components as Record<string, unknown>,
    connections: diagram.snapshot.connections as Record<string, unknown>,
    flows: diagram.snapshot.flows as Record<string, unknown>,
    iconLibrary: diagram.snapshot.iconLibrary as Record<string, unknown>,
    nodeLayouts: diagram.nodeLayouts as Record<string, unknown>,
    edgeLayouts: diagram.edgeLayouts as Record<string, unknown>,
    scenes: (diagram.scenes ?? {}) as Record<string, unknown>,
    activeSceneId: diagram.activeSceneId ?? null,
    compareSceneId: diagram.compareSceneId ?? null,
  };
}

/** Keyed collections diffed per entity. Everything else is sent whole. */
const ENTITY_COLLECTIONS = [
  "components",
  "connections",
  "flows",
  "iconLibrary",
  "nodeLayouts",
  "edgeLayouts",
  "scenes",
] as const satisfies ReadonlyArray<keyof TrackedDiagramState>;

/**
 * Per-entity delta between two versions of a keyed collection, or null when
 * nothing moved.
 *
 * Comparison is by reference: the diagram store updates immutably, so an
 * untouched entity keeps its identity while a changed one does not. That makes
 * this O(n) pointer comparisons rather than a deep diff.
 *
 * A `null` value marks a tombstone — the entity was removed.
 */
export function diffCollection(
  previous: Record<string, unknown>,
  current: Record<string, unknown>,
): Record<string, unknown> | null {
  if (previous === current) return null;

  const delta: Record<string, unknown> = {};
  let changed = false;

  for (const id of Object.keys(current)) {
    if (previous[id] !== current[id]) {
      delta[id] = current[id];
      changed = true;
    }
  }

  for (const id of Object.keys(previous)) {
    if (!Object.prototype.hasOwnProperty.call(current, id)) {
      delta[id] = null;
      changed = true;
    }
  }

  return changed ? delta : null;
}

export function diffPatch(
  previous: TrackedDiagramState,
  current: TrackedDiagramState,
): CollabPatch | null {
  const patch: CollabPatch = {};

  // Collections ship only the entities that actually changed. Sending the whole
  // map made concurrent edits to different entities overwrite each other, and
  // put the entire diagram on the wire for every drag.
  for (const key of ENTITY_COLLECTIONS) {
    const delta = diffCollection(
      previous[key] as Record<string, unknown>,
      current[key] as Record<string, unknown>,
    );
    if (delta) {
      patch[key] = delta;
    }
  }

  if (previous.activeSceneId !== current.activeSceneId) {
    patch.activeSceneId = current.activeSceneId;
  }
  if (previous.compareSceneId !== current.compareSceneId) {
    patch.compareSceneId = current.compareSceneId;
  }
  if (previous.diagramName !== current.diagramName) {
    patch.diagramName = current.diagramName;
  }
  if (previous.domain !== current.domain) {
    patch.domain = current.domain;
  }
  if (previous.description !== current.description) {
    patch.description = current.description;
  }

  return Object.keys(patch).length > 0 ? patch : null;
}

export function useCollabStoreSync({
  diagramId,
  sendPatchRef,
}: UseCollabStoreSyncParams): UseCollabStoreSyncReturn {
  const isApplyingRemoteRef = useRef(false);

  const getSnapshot = useCallback((): CollabSnapshot | null => {
    if (!diagramId) return null;

    const state = useDiagramStore.getState();
    const diagram = state.diagrams[diagramId];
    if (!diagram) return null;

    return {
      diagramId: diagram.id,
      diagramName: diagram.name,
      level: diagram.level,
      domain: diagram.domain,
      description: diagram.description,
      components: diagram.snapshot.components as Record<string, unknown>,
      connections: diagram.snapshot.connections as Record<string, unknown>,
      flows: diagram.snapshot.flows as Record<string, unknown>,
      nodeLayouts: diagram.nodeLayouts as Record<string, unknown>,
      edgeLayouts: diagram.edgeLayouts as Record<string, unknown>,
      iconLibrary: diagram.snapshot.iconLibrary as Record<string, unknown>,
      scenes: (diagram.scenes ?? {}) as Record<string, unknown>,
      activeSceneId: diagram.activeSceneId ?? null,
      compareSceneId: diagram.compareSceneId ?? null,
    };
  }, [diagramId]);

  const onPatch = useCallback(
    (patch: CollabPatch) => {
      if (!diagramId) return;

      isApplyingRemoteRef.current = true;
      try {
        useDiagramStore.setState((previous) => {
          const diagram = previous.diagrams[diagramId];
          if (!diagram) return previous;

          if (patch.nodeLayouts) {
            const nextLayouts = patch.nodeLayouts as Record<string, unknown>;
            for (const [id, nextLayout] of Object.entries(nextLayouts)) {
              if (diagram.nodeLayouts[id] !== nextLayout) {
                remoteLayoutUpdates.add(id);
              }
            }
          }

          const now = Date.now();

          const nextDiagram = {
            ...diagram,
            name:
              hasOwn(patch, "diagramName") && typeof patch.diagramName === "string"
                ? patch.diagramName
                : diagram.name,
            domain: hasOwn(patch, "domain") ? patch.domain : diagram.domain,
            description: hasOwn(patch, "description") ? patch.description : diagram.description,
            snapshot: {
              ...diagram.snapshot,
              components: mergeCollection(diagram.snapshot.components, patch.components),
              connections: mergeCollection(diagram.snapshot.connections, patch.connections),
              flows: mergeCollection(diagram.snapshot.flows, patch.flows),
              iconLibrary: mergeCollection(diagram.snapshot.iconLibrary, patch.iconLibrary),
            },
            nodeLayouts: mergeCollection(diagram.nodeLayouts, patch.nodeLayouts),
            edgeLayouts: mergeCollection(diagram.edgeLayouts, patch.edgeLayouts),
            scenes: mergeCollection(diagram.scenes, patch.scenes),
            activeSceneId: hasOwn(patch, "activeSceneId")
              ? patch.activeSceneId
              : diagram.activeSceneId,
            compareSceneId: hasOwn(patch, "compareSceneId")
              ? patch.compareSceneId
              : diagram.compareSceneId,
            updatedAt: now,
          };

          return {
            ...previous,
            diagrams: {
              ...previous.diagrams,
              [diagramId]: nextDiagram,
            },
          };
        });
      } finally {
        isApplyingRemoteRef.current = false;
      }
    },
    [diagramId],
  );

  useEffect(() => {
    if (!diagramId) return;

    let frame: number | null = null;
    let previousState = pickTrackedState(diagramId);

    const flush = () => {
      frame = null;
      if (isApplyingRemoteRef.current || !previousState) return;

      const currentState = pickTrackedState(diagramId);
      if (!currentState) return;

      const patch = diffPatch(previousState, currentState);
      previousState = currentState;

      if (patch) {
        sendPatchRef.current?.(patch);
      }
    };

    const scheduleFlush = () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      frame = requestAnimationFrame(flush);
    };

    const unsubscribe = useDiagramStore.subscribe((diagramStoreState) => {
      if (isApplyingRemoteRef.current) {
        previousState = pickTrackedState(diagramId);
        return;
      }
      if (!diagramStoreState.diagrams[diagramId]) return;
      scheduleFlush();
    });

    return () => {
      if (frame !== null) {
        cancelAnimationFrame(frame);
      }
      unsubscribe();
    };
  }, [diagramId, sendPatchRef]);

  return {
    getSnapshot,
    onPatch,
  };
}
