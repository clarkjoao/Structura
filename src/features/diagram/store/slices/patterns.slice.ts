import { Component, ComponentType } from "../../model/diagram.types";
import { generateId } from "../../utils/generate-id";
import { AppState } from "../store.types";
import { pushHistory } from "./history.slice";

export const patternsSlice = (
    set: (fn: (state: AppState) => void) => void,
    get: () => AppState,
) => ({
    insertPattern: (template, position) => {
        const GRID_X = 220;
        const ids: string[] = template.components.map(() => generateId("el"));
        set((state) => {
          const d = state.diagrams[state.activeDiagramId!];
          const sid = d.activeSceneId ?? null;
          const scene = sid && d.scenes?.[sid] ? d.scenes[sid] : null;
          if (!scene) pushHistory(state);
          template.components.forEach((c: { name: string; type: ComponentType; description?: string; technology?: string; awsService?: string }, i: number) => {
            const comp: Component = {
              id: ids[i],
              name: c.name,
              type: c.type,
              description: c.description ?? "",
              parentId: null,
              technology: c.technology ?? undefined,
              awsService: c.awsService ?? undefined,
            };
            const layout = { elementId: comp.id, x: position.x + i * GRID_X, y: position.y };
            if (scene) {
              scene.addedComponents[comp.id] = comp;
              scene.nodeLayouts[comp.id] = layout;
            } else {
              d.snapshot.components[comp.id] = comp;
              d.nodeLayouts[comp.id] = layout;
            }
          });
          template.connections.forEach((conn: { fromIndex: number; toIndex: number; label: string }) => {
            const connId = generateId("conn");
            const next = {
              id: connId,
              sourceId: ids[conn.fromIndex],
              targetId: ids[conn.toIndex],
              label: conn.label,
            };
            if (scene) {
              scene.addedConnections[connId] = next;
            } else {
              d.snapshot.connections[connId] = next;
            }
          });
          d.updatedAt = new Date().toISOString();
        });
      },
  });