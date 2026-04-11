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

export const useVisibleComponents = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      const d = s.diagrams[s.activeDiagramId];
      const r = getCachedCanvasSnapshot(d);
      const visibleIds = new Set(Object.keys(r.nodeLayouts));
      return Object.values(r.components).filter((c) => visibleIds.has(c.id));
    }),
  );

export const useVisibleConnections = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      const d = s.diagrams[s.activeDiagramId];
      const r = getCachedCanvasSnapshot(d);
      const visibleIds = new Set(Object.keys(r.nodeLayouts));
      return Object.values(r.connections).filter(
        (conn) => visibleIds.has(conn.sourceId) && visibleIds.has(conn.targetId),
      );
    }),
  );

/** Resolved snapshot.components — reference-stable when only layouts/flows/etc. change. */
export const useResolvedComponents = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return {};
      const d = s.diagrams[s.activeDiagramId];
      return getCachedCanvasSnapshot(d).components;
    }),
  );

/** Resolved snapshot.nodeLayouts — updates when positions/dimensions change. */
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

/** Scene identity for canvas — only changes on scene/diagram switches, not on node moves. */
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
