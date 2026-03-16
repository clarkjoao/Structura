import type { Connection } from "../../model/diagram.types";
import { generateId } from "../../utils/generate-id";
import type { AppState } from "../store.types";
import { pushHistory } from "./history.slice";

export const connectionsSlice = (
  set: (fn: (state: AppState) => void) => void,
  get: () => AppState,
) => ({
    addConnection: (sourceId: string, targetId: string, label: string): Connection => {
      const connection: Connection = {
        id: generateId("conn"),
        sourceId,
        targetId,
        label,
      };
      set((state) => {
        const d = state.diagrams[state.activeDiagramId!];
        if (!d) return;
        pushHistory(state);
        d.snapshot.connections[connection.id] = connection;
        d.updatedAt = new Date().toISOString();
      });
      return connection;
    },

    updateConnection: (id: string, patch: Partial<Omit<Connection, "id">>) => {
      set((state) => {
        const d = state.diagrams[state.activeDiagramId!];
        if (!d) return;
        pushHistory(state);
        Object.assign(d.snapshot.connections[id], patch);
        d.updatedAt = new Date().toISOString();
      });
    },

    removeConnection: (id: string) => {
      set((state) => {
        const d = state.diagrams[state.activeDiagramId!];
        if (!d) return;
        pushHistory(state);
        delete d.snapshot.connections[id];
        d.updatedAt = new Date().toISOString();
      });
    },
  });
