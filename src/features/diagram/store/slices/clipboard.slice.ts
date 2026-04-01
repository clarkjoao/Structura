import type { Component, Connection, NodeLayout } from "../../model/diagram.types";
import { generateId } from "../../utils/generate-id";
import type { AppState } from "../store.types";
import { pushHistory } from "./history.slice";
import { resolveActiveScene } from "./scene-helpers";
import { resolveSceneSnapshot } from "../../utils/scene.utils";

function resolveAbsoluteLayoutPosition(
  id: string,
  layouts: Record<string, { x: number; y: number }>,
  components: Record<string, { parentId?: string | null }>,
): { x: number; y: number } {
  const layout = layouts[id];
  const x = layout?.x ?? 0;
  const y = layout?.y ?? 0;
  const component = components[id];
  if (!component?.parentId) return { x, y };
  const parentAbsolutePosition = resolveAbsoluteLayoutPosition(
    component.parentId,
    layouts,
    components,
  );
  return { x: x + parentAbsolutePosition.x, y: y + parentAbsolutePosition.y };
}

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
          components.push(structuredClone(comp));
          const abs = resolveAbsoluteLayoutPosition(id, r.nodeLayouts, r.components);
          absPositions.push(abs);
        }

        const connections = Object.values(r.connections)
          .filter((c) => idSet.has(c.sourceId) && idSet.has(c.targetId))
          .map((c) => structuredClone(c));

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

    pasteFromClipboard: (
      position?: { x: number; y: number },
      options?: { preserveParentWhenMissing?: boolean },
    ): string[] => {
      let pastedIds: string[] = [];
      set((state) => {
        if (!state.clipboard || !state.activeDiagramId) return;
        const d = state.diagrams[state.activeDiagramId];
        if (!d) return;
        pushHistory(state);
        const scene = resolveActiveScene(d);
        const idMap: Record<string, string> = {};
        const baseX = position?.x ?? 300;
        const baseY = position?.y ?? 300;
        const pasteOffsets = state.clipboard._pasteOffsets;
        const pastedSourceIds = new Set(state.clipboard.components.map((component) => component.id));
        const activeComponents = scene ? resolveSceneSnapshot(d, d.activeSceneId ?? null).components : d.snapshot.components;
        state.clipboard.components.forEach((c: Component, index: number) => {
          const newId = generateId("el");
          idMap[c.id] = newId;
          const parentIsAlsoPasted = c.parentId ? pastedSourceIds.has(c.parentId) : false;
          const parentExistsInActiveDiagram = c.parentId ? Boolean(activeComponents[c.parentId]) : false;
          const parentId = parentIsAlsoPasted
            ? c.parentId
            : options?.preserveParentWhenMissing && parentExistsInActiveDiagram
              ? c.parentId
              : null;
          const comp = { ...structuredClone(c), id: newId, parentId };
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
        for (const originalComponent of state.clipboard.components) {
          const newComponentId = idMap[originalComponent.id];
          if (!newComponentId) continue;
          const newParentId =
            originalComponent.parentId && idMap[originalComponent.parentId]
              ? idMap[originalComponent.parentId]
              : null;
          if (!newParentId) continue;
          if (scene) {
            const existing = scene.addedComponents[newComponentId];
            if (existing) existing.parentId = newParentId;
          } else {
            const existing = d.snapshot.components[newComponentId];
            if (existing) existing.parentId = newParentId;
          }
        }
        state.clipboard.components.forEach((originalComponent) => {
          const newComponentId = idMap[originalComponent.id];
          if (!newComponentId) return;

          const newParentId =
            originalComponent.parentId && idMap[originalComponent.parentId]
              ? idMap[originalComponent.parentId]
              : null;
          if (!newParentId) return;

          const parentLayout = scene ? scene.nodeLayouts[newParentId] : d.nodeLayouts[newParentId];
          if (!parentLayout) return;

          const childLayout = scene ? scene.nodeLayouts[newComponentId] : d.nodeLayouts[newComponentId];
          if (!childLayout) return;

          childLayout.x -= parentLayout.x;
          childLayout.y -= parentLayout.y;
        });
        state.clipboard.connections.forEach((conn: Connection) => {
          const src = idMap[conn.sourceId];
          const tgt = idMap[conn.targetId];
          if (src && tgt) {
            const newId = generateId("conn");
            const next = { ...structuredClone(conn), id: newId, sourceId: src, targetId: tgt };
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
