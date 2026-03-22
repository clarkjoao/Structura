import { useShallow } from "zustand/react/shallow";
import { useDiagramStore } from "../diagram.store";
import { resolveCanvasSnapshot } from "../../utils/scene.utils";

export const useConnectionIds = () =>
  useDiagramStore((s) => {
    if (!s.activeDiagramId) return [];
    const d = s.diagrams[s.activeDiagramId];
    return Object.keys(resolveCanvasSnapshot(d).connections);
  });

export const useConnection = (id: string) =>
  useDiagramStore((s) => {
    if (!s.activeDiagramId) return undefined;
    const d = s.diagrams[s.activeDiagramId];
    return resolveCanvasSnapshot(d).connections[id];
  });

export const useConnections = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return {};
      const d = s.diagrams[s.activeDiagramId];
      return resolveCanvasSnapshot(d).connections;
    }),
  );

export const useVisibleComponents = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      const d = s.diagrams[s.activeDiagramId];
      const r = resolveCanvasSnapshot(d);
      const visibleIds = new Set(Object.keys(r.nodeLayouts));
      return Object.values(r.components).filter((c) => visibleIds.has(c.id));
    }),
  );

export const useVisibleConnections = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      const d = s.diagrams[s.activeDiagramId];
      const r = resolveCanvasSnapshot(d);
      const visibleIds = new Set(Object.keys(r.nodeLayouts));
      return Object.values(r.connections).filter(
        (conn) => visibleIds.has(conn.sourceId) && visibleIds.has(conn.targetId),
      );
    }),
  );
