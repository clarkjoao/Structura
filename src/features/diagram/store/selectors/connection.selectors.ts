import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { useDiagramStore } from "../diagram.store";
import { getCachedCanvasSnapshot } from "../../utils/snapshot-cache";
import { placedComponents, placedConnections } from "../../utils/placement";

export const useConnectionIds = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      const d = s.diagrams[s.activeDiagramId];
      return Object.keys(getCachedCanvasSnapshot(d).connections);
    }),
  );

export const useConnection = (id: string) =>
  useDiagramStore((s) => {
    if (!s.activeDiagramId) return undefined;
    const d = s.diagrams[s.activeDiagramId];
    return getCachedCanvasSnapshot(d).connections[id];
  });

export const useConnections = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return {};
      const d = s.diagrams[s.activeDiagramId];
      return getCachedCanvasSnapshot(d).connections;
    }),
  );

export const useVisibleComponents = () => {
  const components = useDiagramStore((s) => {
    if (!s.activeDiagramId) return undefined;
    const d = s.diagrams[s.activeDiagramId];
    return getCachedCanvasSnapshot(d).components;
  });
  const nodeLayouts = useDiagramStore((s) => {
    if (!s.activeDiagramId) return undefined;
    const d = s.diagrams[s.activeDiagramId];
    return getCachedCanvasSnapshot(d).nodeLayouts;
  });
  // The placement rule the viewer's `resolveViewSnapshot` uses too.
  return useMemo(() => {
    if (!components || !nodeLayouts) return [];
    return placedComponents(components, nodeLayouts);
  }, [components, nodeLayouts]);
};

export const useVisibleConnections = () => {
  const connections = useDiagramStore((s) => {
    if (!s.activeDiagramId) return undefined;
    const d = s.diagrams[s.activeDiagramId];
    return getCachedCanvasSnapshot(d).connections;
  });
  const nodeLayouts = useDiagramStore((s) => {
    if (!s.activeDiagramId) return undefined;
    const d = s.diagrams[s.activeDiagramId];
    return getCachedCanvasSnapshot(d).nodeLayouts;
  });
  return useMemo(() => {
    if (!connections || !nodeLayouts) return [];
    return placedConnections(connections, nodeLayouts);
  }, [connections, nodeLayouts]);
};

export const useResolvedComponents = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return {};
      const d = s.diagrams[s.activeDiagramId];
      return getCachedCanvasSnapshot(d).components;
    }),
  );

export const useResolvedNodeLayouts = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return {};
      const d = s.diagrams[s.activeDiagramId];
      return getCachedCanvasSnapshot(d).nodeLayouts;
    }),
  );

export type ActiveDiagramSceneState = {
  id: string;
  activeSceneId: string | null;
  hasActiveScene: boolean;
};

export const useActiveDiagramSceneState = (): ActiveDiagramSceneState | null =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return null;
      const d = s.diagrams[s.activeDiagramId];
      const activeSceneId = d.activeSceneId ?? null;
      const hasActiveScene = !!activeSceneId && !!d.scenes?.[activeSceneId];
      return {
        id: d.id,
        activeSceneId,
        hasActiveScene,
      };
    }),
  );
