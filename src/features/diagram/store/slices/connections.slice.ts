import type { Connection } from "../../model/diagram.types";
import type { EdgeStyle } from "../../model/connection.types";
import { EdgeStyle as EdgeStyleEnum } from "../../enums";
import { generateId } from "../../utils/generate-id";
import type { AppState } from "../store.types";
import { STRUCTURAL_MUTATION_MARKER } from "../store.constants";
import { pushHistory } from "./history.slice";
import { getActiveDiagram } from "./get-active-diagram";
import { resolveActiveScene } from "./scene-helpers";
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
        const d = getActiveDiagram(state);
        if (!d) return;
        const scene = resolveActiveScene(d);
        if (!scene) pushHistory(state, STRUCTURAL_MUTATION_MARKER);
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
        const d = getActiveDiagram(state);
        if (!d) return;
        const scene = resolveActiveScene(d);
        const inScene = !!(scene && scene.addedConnections[id]);
        if (!inScene) pushHistory(state);
        const conn = inScene ? scene!.addedConnections[id] : d.snapshot.connections[id];
        if (conn) Object.assign(conn, patch);
        d.updatedAt = new Date().toISOString();
      });
    },

    removeConnection: (id: string) => {
      set((state) => {
        const d = getActiveDiagram(state);
        if (!d) return;
        const scene = resolveActiveScene(d);
        if (scene) {
          mutateRemoveConnectionInScene(d, scene.id, id);
          d.updatedAt = new Date().toISOString();
          return;
        }
        pushHistory(state, STRUCTURAL_MUTATION_MARKER);
        delete d.snapshot.connections[id];
        d.updatedAt = new Date().toISOString();
      });
    },
  });
