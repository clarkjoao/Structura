import type { Component, Connection } from "../../model/diagram.types";
import { generateId } from "../../utils/generate-id";
import type { AppState } from "../store.types";
import { deepClone, pushHistory } from "./history.slice";
import { resolveSceneSnapshot } from "../../utils/scene.utils";

export const clipboardSlice = (
  set: (fn: (state: AppState) => void) => void,
  get: () => AppState,
) => ({
    clipboard: null,
    copyToClipboard: (componentIds: string[]) => {
      set((state) => {
        if (!state.activeDiagramId) return;
        const d = state.diagrams[state.activeDiagramId];
        if (!d) return;
        const idSet = new Set(componentIds);
        const r = resolveSceneSnapshot(d, d.activeSceneId ?? null);
        const components = componentIds
          .map((id) => r.components[id])
          .filter((c): c is Component => !!c)
          .map((c) => deepClone(c));
        const connections = Object.values(r.connections)
          .filter((c) => idSet.has(c.sourceId) && idSet.has(c.targetId))
          .map((c) => deepClone(c));
        state.clipboard = { components, connections };
      });
    },

    pasteFromClipboard: (position?: { x: number; y: number }) => {
      set((state) => {
        if (!state.clipboard || !state.activeDiagramId) return;
        const d = state.diagrams[state.activeDiagramId];
        if (!d) return;
        const sid = d.activeSceneId ?? null;
        const scene = sid && d.scenes?.[sid] ? d.scenes[sid] : null;
        if (!scene) pushHistory(state);
        const idMap: Record<string, string> = {};
        const baseX = position?.x ?? 300;
        const baseY = position?.y ?? 300;
        state.clipboard.components.forEach((c: Component, i: number) => {
          const newId = generateId("el");
          idMap[c.id] = newId;
          const comp = { ...deepClone(c), id: newId, parentId: null };
          const layout = { elementId: newId, x: baseX + i * 20, y: baseY + i * 20 };
          if (scene) {
            scene.addedComponents[newId] = comp;
            scene.nodeLayouts[newId] = layout;
          } else {
            d.snapshot.components[newId] = comp;
            d.nodeLayouts[newId] = layout;
          }
        });
        state.clipboard.connections.forEach((conn: Connection) => {
          const src = idMap[conn.sourceId];
          const tgt = idMap[conn.targetId];
          if (src && tgt) {
            const newId = generateId("conn");
            const next = { ...deepClone(conn), id: newId, sourceId: src, targetId: tgt };
            if (scene) {
              scene.addedConnections[newId] = next;
            } else {
              d.snapshot.connections[newId] = next;
            }
          }
        });
        d.updatedAt = new Date().toISOString();
      });
    },

    clearClipboard: () => {
      set((state) => {
        state.clipboard = null;
      });
    },
});
