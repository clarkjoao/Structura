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
        pushHistory(state);
        const d = state.diagrams[state.activeDiagramId!];
        d.snapshot.connections[connection.id] = connection;
        d.updatedAt = "agora";
      });
      return connection;
    },

    updateConnection: (id: string, patch: Partial<Omit<Connection, "id">>) => {
      set((state) => {
        pushHistory(state);
        const d = state.diagrams[state.activeDiagramId!];
        Object.assign(d.snapshot.connections[id], patch);
        d.updatedAt = "agora";
      });
    },

    removeConnection: (id: string) => {
      set((state) => {
        pushHistory(state);
        const d = state.diagrams[state.activeDiagramId!];
        delete d.snapshot.connections[id];
        d.updatedAt = "agora";
      });
    },
  });
