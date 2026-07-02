import type { Component, Connection, FlowStep, NodeLayout } from "../../model/diagram.types";
import { current } from "immer";
import { generateId } from "../../utils/generate-id";
import type { AppState, ClipboardEntry } from "../store.types";
import { STRUCTURAL_MUTATION_MARKER } from "../store.constants";
import { pushHistory } from "./history.slice";
import {
  getActiveComponents,
  getActiveNodeLayouts,
  resolveActiveScene,
  writeComponentAndLayout,
} from "./scene-helpers";
import { touchDiagram } from "./get-active-diagram";
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
  _get: () => AppState,
) => ({
    clipboard: null as ClipboardEntry | null,
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
          components.push(current(comp));
          const abs = resolveAbsoluteLayoutPosition(id, r.nodeLayouts, r.components);
          absPositions.push(abs);
        }

        const connections = Object.values(r.connections)
          .filter((c) => idSet.has(c.sourceId) && idSet.has(c.targetId))
          .map((connection) => current(connection));

        const relativeOffsets =
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

        state.clipboard = { components, connections, relativeOffsets };
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
        pushHistory(state, STRUCTURAL_MUTATION_MARKER);
        const scene = resolveActiveScene(d);
        const idMap: Record<string, string> = {};
        const baseX = position?.x ?? 300;
        const baseY = position?.y ?? 300;
        const pasteOffsets = state.clipboard.relativeOffsets;
        const pastedSourceIds = new Set(state.clipboard.components.map((component) => component.id));
        const availableComponents = scene
          ? resolveSceneSnapshot(d, d.activeSceneId ?? null).components
          : getActiveComponents(d, scene);
        const activeComponents = getActiveComponents(d, scene);
        const activeNodeLayouts = getActiveNodeLayouts(d, scene);
        state.clipboard.components.forEach((c: Component, index: number) => {
          const newId = generateId("el");
          idMap[c.id] = newId;
          const parentIsAlsoPasted = c.parentId ? pastedSourceIds.has(c.parentId) : false;
          const parentExistsInActiveDiagram = c.parentId
            ? Boolean(availableComponents[c.parentId])
            : false;
          const parentId = parentIsAlsoPasted
            ? c.parentId
            : options?.preserveParentWhenMissing && parentExistsInActiveDiagram
              ? c.parentId
              : null;
          const comp = { ...current(c), id: newId, parentId };
          const offset = pasteOffsets?.[index];
          const layout = {
            elementId: newId,
            x: baseX + (offset?.dx ?? index * 20),
            y: baseY + (offset?.dy ?? index * 20),
          };
          writeComponentAndLayout(d, scene, comp, layout);
        });
        for (const originalComponent of state.clipboard.components) {
          const newComponentId = idMap[originalComponent.id];
          if (!newComponentId) continue;
          const newParentId =
            originalComponent.parentId && idMap[originalComponent.parentId]
              ? idMap[originalComponent.parentId]
              : null;
          if (!newParentId) continue;
          const existing = activeComponents[newComponentId];
          if (existing) existing.parentId = newParentId;
        }
        state.clipboard.components.forEach((originalComponent) => {
          const newComponentId = idMap[originalComponent.id];
          if (!newComponentId) return;

          const newParentId =
            originalComponent.parentId && idMap[originalComponent.parentId]
              ? idMap[originalComponent.parentId]
              : null;
          if (!newParentId) return;

          const parentLayout = activeNodeLayouts[newParentId];
          if (!parentLayout) return;

          const childLayout = activeNodeLayouts[newComponentId];
          if (!childLayout) return;

          childLayout.x -= parentLayout.x;
          childLayout.y -= parentLayout.y;
        });
        state.clipboard.connections.forEach((conn: Connection) => {
          const src = idMap[conn.sourceId];
          const tgt = idMap[conn.targetId];
          if (src && tgt) {
            const newId = generateId("conn");
            const next = { ...current(conn), id: newId, sourceId: src, targetId: tgt };
            if (scene) {
              scene.addedConnections[newId] = next;
            } else {
              d.snapshot.connections[newId] = next;
            }
          }
        });
        touchDiagram(d);
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
        pushHistory(state, STRUCTURAL_MUTATION_MARKER);
        components.forEach((comp, index) => {
          d.snapshot.components[comp.id] = comp;
          const layout = layouts[index];
          if (layout) d.nodeLayouts[comp.id] = { ...layout, elementId: comp.id };
        });
        connections.forEach((conn) => {
          d.snapshot.connections[conn.id] = conn;
        });
        ids = components.map((component) => component.id);
        touchDiagram(d);
      });
      return ids;
    },

    importMermaidSequenceResult: (
      components: Component[],
      connections: Connection[],
      steps: Record<string, FlowStep>,
      entryStepId: string,
      flowName: string,
      layouts: NodeLayout[],
    ): string => {
      let flowId = "";
      set((state) => {
        if (!state.activeDiagramId) return;
        const d = state.diagrams[state.activeDiagramId];
        if (!d) return;
        pushHistory(state, STRUCTURAL_MUTATION_MARKER);

        components.forEach((comp, index) => {
          d.snapshot.components[comp.id] = comp;
          const layout = layouts[index];
          if (layout) d.nodeLayouts[comp.id] = { ...layout, elementId: comp.id };
        });

        connections.forEach((conn) => {
          d.snapshot.connections[conn.id] = conn;
        });

        flowId = generateId("flow");
        d.snapshot.flows[flowId] = {
          id: flowId,
          name: flowName,
          mermaid: "",
          diagramId: state.activeDiagramId,
          steps,
          entryStepId,
        };

        touchDiagram(d);
      });
      return flowId;
    },

    clearClipboard: () => {
      set((state) => {
        state.clipboard = null;
      });
    },
});
