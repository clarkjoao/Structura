import { useShallow } from "zustand/react/shallow";
import { useDiagramStore } from "../diagram.store";

export const useConnectionIds = () =>
  useDiagramStore((s) => {
    if (!s.activeDiagramId) return [];

    return Object.keys(
      s.diagrams[s.activeDiagramId].snapshot.connections,
    );
  });

export const useConnection = (id: string) =>
  useDiagramStore((s) => {
    if (!s.activeDiagramId) return undefined;

    return s.diagrams[s.activeDiagramId]
      .snapshot.connections[id];
  });

export const useConnections = () =>
  useDiagramStore((s) =>
    s.activeDiagramId ? s.diagrams[s.activeDiagramId].snapshot.connections : {},
  );

export const useVisibleComponents = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      const d = s.diagrams[s.activeDiagramId];
      const visibleIds = new Set(Object.keys(d.nodeLayouts));
      return Object.values(d.snapshot.components).filter((c) => visibleIds.has(c.id));
    }),
  );

export const useVisibleConnections = () =>
  useDiagramStore(
    useShallow((s) => {
      if (!s.activeDiagramId) return [];
      const d = s.diagrams[s.activeDiagramId];
      const visibleIds = new Set(Object.keys(d.nodeLayouts));
      return Object.values(d.snapshot.connections).filter(
        (conn) => visibleIds.has(conn.sourceId) && visibleIds.has(conn.targetId),
      );
    }),
  );