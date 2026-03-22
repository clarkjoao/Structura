import { useShallow } from "zustand/react/shallow";
import { useDiagramStore } from "../diagram.store";
import { resolveSceneSnapshot } from "../../utils/scene.utils";

export const useConnectionIds = () =>
  useDiagramStore((s) => {
    if (!s.activeDiagramId) return [];
    const d = s.diagrams[s.activeDiagramId];
    return Object.keys(resolveSceneSnapshot(d, d.activeSceneId ?? null).connections);
  });

export const useConnection = (id: string) =>
  useDiagramStore((s) => {
    if (!s.activeDiagramId) return undefined;
    const d = s.diagrams[s.activeDiagramId];
    return resolveSceneSnapshot(d, d.activeSceneId ?? null).connections[id];
  });

export const useConnections = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return {};
      const d = s.diagrams[s.activeDiagramId];
      return resolveSceneSnapshot(d, d.activeSceneId ?? null).connections;
    }),
  );

export const useVisibleComponents = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      const d = s.diagrams[s.activeDiagramId];
      const r = resolveSceneSnapshot(d, d.activeSceneId ?? null);
      const visibleIds = new Set(Object.keys(r.nodeLayouts));
      return Object.values(r.components).filter((c) => visibleIds.has(c.id));
    }),
  );

export const useVisibleConnections = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      const d = s.diagrams[s.activeDiagramId];
      const r = resolveSceneSnapshot(d, d.activeSceneId ?? null);
      const visibleIds = new Set(Object.keys(r.nodeLayouts));
      return Object.values(r.connections).filter(
        (conn) => visibleIds.has(conn.sourceId) && visibleIds.has(conn.targetId),
      );
    }),
  );