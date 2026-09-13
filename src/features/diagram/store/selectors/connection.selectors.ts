import { useShallow } from "zustand/react/shallow";
import { useDiagramStore } from "../diagram.store";
import { getCachedCanvasSnapshot } from "../../utils/snapshot-cache";

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

/** Components present in the active scene-aware canvas snapshot (layouts define visibility). */
export const useVisibleComponents = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      const d = s.diagrams[s.activeDiagramId];
      const { components, nodeLayouts } = getCachedCanvasSnapshot(d);
      const visibleIds = new Set(Object.keys(nodeLayouts));
      return Object.values(components).filter((c) => visibleIds.has(c.id));
    }),
  );

/** Connections whose endpoints are both visible in the active canvas snapshot. */
export const useVisibleConnections = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      const d = s.diagrams[s.activeDiagramId];
      const { connections, nodeLayouts } = getCachedCanvasSnapshot(d);
      const visibleIds = new Set(Object.keys(nodeLayouts));
      return Object.values(connections).filter(
        (conn) => visibleIds.has(conn.sourceId) && visibleIds.has(conn.targetId),
      );
    }),
  );

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
