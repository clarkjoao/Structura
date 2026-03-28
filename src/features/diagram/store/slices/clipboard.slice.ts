import type { Component, Connection, NodeLayout } from "../../model/diagram.types";
import { generateId } from "../../utils/generate-id";
import type { AppState } from "../store.types";
import { deepClone, pushHistory } from "./history.slice";
import { resolveActiveScene } from "./scene-helpers";
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

        const components: Component[] = [];
        const absPositions: { x: number; y: number }[] = [];

        for (const id of componentIds) {
          const comp = r.components[id];
          if (!comp) continue;
          components.push(deepClone(comp));

          const layout = r.nodeLayouts[id];
          let x = layout?.x ?? 0;
          let y = layout?.y ?? 0;
          if (comp.parentId) {
            const parentLayout = r.nodeLayouts[comp.parentId];
            if (parentLayout) {
              x += parentLayout.x;
              y += parentLayout.y;
            }
          }
          absPositions.push({ x, y });
        }

        const connections = Object.values(r.connections)
          .filter((c) => idSet.has(c.sourceId) && idSet.has(c.targetId))
          .map((c) => deepClone(c));

        const _pasteOffsets =
          absPositions.length > 0
            ? (() => {
                const minX = Math.min(...absPositions.map((point) => point.x));
                const minY = Math.min(...absPositions.map((point) => point.y));
                return absPositions.map((point) => ({
                  dx: point.x - minX,
                  dy: point.y - minY,
                }));
              })()
            : [];

        state.clipboard = { components, connections, _pasteOffsets };
      });
    },

    pasteFromClipboard: (position?: { x: number; y: number }): string[] => {
      let pastedIds: string[] = [];
      set((state) => {
        if (!state.clipboard || !state.activeDiagramId) return;
        const d = state.diagrams[state.activeDiagramId];
        if (!d) return;
        const scene = resolveActiveScene(d);
        if (!scene) pushHistory(state);
        const idMap: Record<string, string> = {};
        const baseX = position?.x ?? 300;
        const baseY = position?.y ?? 300;
        const pasteOffsets = state.clipboard._pasteOffsets;
        state.clipboard.components.forEach((c: Component, index: number) => {
          const newId = generateId("el");
          idMap[c.id] = newId;
          const comp = { ...deepClone(c), id: newId, parentId: null };
          const offset = pasteOffsets?.[index];
          const layout = {
            elementId: newId,
            x: baseX + (offset?.dx ?? index * 20),
            y: baseY + (offset?.dy ?? index * 20),
          };
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
        pastedIds = state.clipboard.components
          .map((component) => idMap[component.id])
          .filter((id): id is string => Boolean(id));
      });
      return pastedIds;
    },

    importDrawioResult: (
      components: Component[],
      connections: Connection[],
      layouts: NodeLayout[],
    ): string[] => {
      let ids: string[] = [];
      set((state) => {
        if (!state.activeDiagramId) return;
        const d = state.diagrams[state.activeDiagramId];
        if (!d) return;
        pushHistory(state);
        components.forEach((comp, index) => {
          d.snapshot.components[comp.id] = comp;
          const layout = layouts[index];
          if (layout) d.nodeLayouts[comp.id] = { ...layout, elementId: comp.id };
        });
        connections.forEach((conn) => {
          d.snapshot.connections[conn.id] = conn;
        });
        ids = components.map((component) => component.id);
        d.updatedAt = new Date().toISOString();
      });
      return ids;
    },

    clearClipboard: () => {
      set((state) => {
        state.clipboard = null;
      });
    },
});
