import type { Connection } from "../../model/diagram.types";
import type { EdgeStyle } from "../../model/connection.types";
import { EdgeStyle as EdgeStyleEnum } from "../../enums";
import { generateId } from "../../utils/generate-id";
import type { AppState } from "../store.types";
import { pushHistory } from "./history.slice";
import { mutateRemoveConnectionInScene } from "../../utils/scene-mutations";

export const connectionsSlice = (
  set: (fn: (state: AppState) => void) => void,
  get: () => AppState,
) => ({
    addConnection: (
      sourceId: string,
      targetId: string,
      label: string,
      edgeStyle: EdgeStyle = EdgeStyleEnum.Smoothstep,
    ): Connection => {
      const connection: Connection = {
        id: generateId("conn"),
        sourceId,
        targetId,
        label,
        style: {
          edgeStyle,
        },
      };
      set((state) => {
        const d = state.diagrams[state.activeDiagramId!];
        if (!d) return;
        const sid = d.activeSceneId ?? null;
        const scene = sid && d.scenes?.[sid] ? d.scenes[sid] : null;
        if (!scene) pushHistory(state);
        if (scene) {
          scene.addedConnections[connection.id] = connection;
        } else {
          d.snapshot.connections[connection.id] = connection;
        }
        d.updatedAt = new Date().toISOString();
      });
      return connection;
    },

    updateConnection: (id: string, patch: Partial<Omit<Connection, "id">>) => {
      set((state) => {
        const d = state.diagrams[state.activeDiagramId!];
        if (!d) return;
        const sid = d.activeSceneId ?? null;
        const scene = sid && d.scenes?.[sid] ? d.scenes[sid] : null;
        const inScene = !!(scene && scene.addedConnections[id]);
        if (!inScene) pushHistory(state);
        const conn = inScene ? scene!.addedConnections[id] : d.snapshot.connections[id];
        if (conn) Object.assign(conn, patch);
        d.updatedAt = new Date().toISOString();
      });
    },

    removeConnection: (id: string) => {
      set((state) => {
        const d = state.diagrams[state.activeDiagramId!];
        if (!d) return;
        const sid = d.activeSceneId ?? null;
        const scene = sid && d.scenes?.[sid] ? d.scenes[sid] : null;
        if (scene) {
          mutateRemoveConnectionInScene(d, sid!, id);
          d.updatedAt = new Date().toISOString();
          return;
        }
        pushHistory(state);
        delete d.snapshot.connections[id];
        d.updatedAt = new Date().toISOString();
      });
    },
  });
