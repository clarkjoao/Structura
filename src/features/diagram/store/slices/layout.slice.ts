import type { Point } from "../../model/diagram.types";
import type { AppState } from "../store.types";
import { pushHistory } from "./history.slice";
import { getActiveDiagram } from "./get-active-diagram";
import { resolveActiveScene } from "./scene-helpers";

export const layoutSlice = (
    set: (fn: (state: AppState) => void) => void,
    get: () => AppState,
) => ({
    updateNodeLayout: (elementId: string, position: { x: number; y: number }, dimensions?: { width: number; height: number }) => {
      set((state) => {
        const d = getActiveDiagram(state);
        if (!d) return;
        const scene = resolveActiveScene(d);
        if (scene && scene.addedComponents[elementId]) {
          const layout = scene.nodeLayouts[elementId];
          if (layout) {
            layout.x = position.x;
            layout.y = position.y;
            if (dimensions) {
              layout.width = dimensions.width;
              layout.height = dimensions.height;
            }
          }
          return;
        }
        const layout = d.nodeLayouts[elementId];
        if (layout) {
          layout.x = position.x;
          layout.y = position.y;
          if (dimensions) {
            layout.width = dimensions.width;
            layout.height = dimensions.height;
          }
        }
      });
    },

    updateViewport: (viewport: { x: number; y: number; zoom: number }) => {
      set((state) => {
        const d = getActiveDiagram(state);
        if (!d) return;
        d.viewport = viewport;
      });
    },

    updateEdgeWaypoints: (diagramId: string, connectionId: string, waypoints: Point[]) => {
      set((state) => {
        const diagram = state.diagrams[diagramId];
        if (!diagram) return;
        const existing = diagram.edgeLayouts.find((layout) => layout.connectionId === connectionId);
        if (existing) {
          existing.waypoints = waypoints;
        } else {
          diagram.edgeLayouts.push({ connectionId, waypoints });
        }
      });
    },

    clearEdgeWaypoints: (diagramId: string, connectionId: string) => {
      set((state) => {
        const diagram = state.diagrams[diagramId];
        if (!diagram?.edgeLayouts?.length) return;
        const index = diagram.edgeLayouts.findIndex((layout) => layout.connectionId === connectionId);
        if (index === -1) return;
        diagram.edgeLayouts.splice(index, 1);
      });
    },

    updateEdgeLabelOffset: (diagramId: string, connectionId: string, offset: number) => {
      set((state) => {
        const diagram = state.diagrams[diagramId];
        if (!diagram) return;
        const safe = Math.max(0, Math.min(1, offset));
        const existing = diagram.edgeLayouts.find((layout) => layout.connectionId === connectionId);
        if (existing) {
          existing.labelOffset = safe;
        } else {
          diagram.edgeLayouts.push({ connectionId, waypoints: [], labelOffset: safe });
        }
      });
    },

    bringToFront: (elementId: string) => {
      set((state) => {
        const d = getActiveDiagram(state);
        if (!d) return;
        pushHistory(state);
        const scene = resolveActiveScene(d);
        if (scene && scene.addedComponents[elementId]) {
          const merged = { ...d.nodeLayouts, ...scene.nodeLayouts };
          const vals = Object.values(merged).map((nl) => nl.zIndex ?? 0);
          const maxZ = vals.length > 0 ? Math.max(...vals) : 0;
          const layout = scene.nodeLayouts[elementId];
          if (layout) layout.zIndex = maxZ + 1;
          return;
        }
        const vals = Object.values(d.nodeLayouts).map((nl) => nl.zIndex ?? 0);
        const maxZ = vals.length > 0 ? Math.max(...vals) : 0;
        const layout = d.nodeLayouts[elementId];
        if (layout) layout.zIndex = maxZ + 1;
      });
    },

    sendToBack: (elementId: string) => {
      set((state) => {
        const d = getActiveDiagram(state);
        if (!d) return;
        pushHistory(state);
        const scene = resolveActiveScene(d);
        if (scene && scene.addedComponents[elementId]) {
          const merged = { ...d.nodeLayouts, ...scene.nodeLayouts };
          const vals = Object.values(merged).map((nl) => nl.zIndex ?? 0);
          const minZ = vals.length > 0 ? Math.min(...vals) : 0;
          const layout = scene.nodeLayouts[elementId];
          if (layout) layout.zIndex = minZ - 1;
          return;
        }
        const vals = Object.values(d.nodeLayouts).map((nl) => nl.zIndex ?? 0);
        const minZ = vals.length > 0 ? Math.min(...vals) : 0;
        const layout = d.nodeLayouts[elementId];
        if (layout) layout.zIndex = minZ - 1;
      });
    },
  });
