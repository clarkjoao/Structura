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
  edgeLayouts: unknown[];
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
    edgeLayouts: diagram.edgeLayouts as unknown[],
    scenes: (diagram.scenes ?? {}) as Record<string, unknown>,
    activeSceneId: diagram.activeSceneId ?? null,
    compareSceneId: diagram.compareSceneId ?? null,
  };
}

function diffPatch(
  previous: TrackedDiagramState,
  current: TrackedDiagramState,
): CollabPatch | null {
  const patch: CollabPatch = {};

  if (previous.components !== current.components) {
    patch.components = current.components;
  }
  if (previous.connections !== current.connections) {
    patch.connections = current.connections;
  }
  if (previous.flows !== current.flows) {
    patch.flows = current.flows;
  }
  if (previous.iconLibrary !== current.iconLibrary) {
    patch.iconLibrary = current.iconLibrary;
  }
  if (previous.nodeLayouts !== current.nodeLayouts) {
    patch.nodeLayouts = current.nodeLayouts;
  }
  if (previous.edgeLayouts !== current.edgeLayouts) {
    patch.edgeLayouts = current.edgeLayouts;
  }
  if (previous.scenes !== current.scenes) {
    patch.scenes = current.scenes;
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
      edgeLayouts: diagram.edgeLayouts as unknown[],
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

          const now = new Date().toISOString();

          const nextDiagram = {
            ...diagram,
            name: hasOwn(patch, "diagramName") && typeof patch.diagramName === "string"
              ? patch.diagramName
              : diagram.name,
            domain: hasOwn(patch, "domain")
              ? patch.domain
              : diagram.domain,
            description: hasOwn(patch, "description")
              ? patch.description
              : diagram.description,
            snapshot: {
              ...diagram.snapshot,
              components: patch.components
                ? (patch.components as typeof diagram.snapshot.components)
                : diagram.snapshot.components,
              connections: patch.connections
                ? (patch.connections as typeof diagram.snapshot.connections)
                : diagram.snapshot.connections,
              flows: patch.flows
                ? (patch.flows as typeof diagram.snapshot.flows)
                : diagram.snapshot.flows,
              iconLibrary: patch.iconLibrary
                ? (patch.iconLibrary as typeof diagram.snapshot.iconLibrary)
                : diagram.snapshot.iconLibrary,
            },
            nodeLayouts: patch.nodeLayouts
              ? (patch.nodeLayouts as typeof diagram.nodeLayouts)
              : diagram.nodeLayouts,
            edgeLayouts: patch.edgeLayouts
              ? (patch.edgeLayouts as typeof diagram.edgeLayouts)
              : diagram.edgeLayouts,
            scenes: patch.scenes
              ? (patch.scenes as typeof diagram.scenes)
              : diagram.scenes,
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
        sendPatchRef.current(patch);
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
