import type { Point } from "../../model/diagram.types";
import type { AppState } from "../store.types";
import { pushHistory } from "./history.slice";
import { getActiveDiagram } from "./get-active-diagram";
import { resolveActiveScene } from "./scene-helpers";
import { computeFitBounds } from "../../utils/fit-group-to-children";

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

    /** edgeLayouts is linear; find/findIndex are O(n). A connectionId→layout map would scale better for huge graphs. */
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

    fitGroupToChildren: (panelId: string) => {
      set((state) => {
        const d = getActiveDiagram(state);
        if (!d) return;

        const scene = resolveActiveScene(d);
        const layouts = scene ? { ...d.nodeLayouts, ...scene.nodeLayouts } : d.nodeLayouts;
        const components = scene
          ? { ...d.snapshot.components, ...scene.addedComponents }
          : d.snapshot.components;

        
        const panelComp = components[panelId];
        if (!panelComp) return;
        if ("collapsed" in panelComp && panelComp.collapsed) return;

        
        const childLayouts = Object.values(components)
          .filter((c) => c.parentId === panelId)
          .map((c) => layouts[c.id])
          .filter(Boolean);

        if (childLayouts.length === 0) return;

        const bounds = computeFitBounds(childLayouts);
        if (!bounds) return;

        
        pushHistory(state);

        
        const dx = bounds.x;
        const dy = bounds.y;

        for (const comp of Object.values(components)) {
          if (comp.parentId !== panelId) continue;
          const layoutTarget = scene?.addedComponents[comp.id]
            ? scene!.nodeLayouts
            : d.nodeLayouts;
          const childLayout = layoutTarget[comp.id];
          if (childLayout) {
            childLayout.x -= dx;
            childLayout.y -= dy;
          }
        }

        
        const panelLayoutTarget = scene?.addedComponents[panelId]
          ? scene!.nodeLayouts
          : d.nodeLayouts;
        const panelLayout = panelLayoutTarget[panelId];
        if (!panelLayout) return;

        panelLayout.x += dx;
        panelLayout.y += dy;
        panelLayout.width  = bounds.width;
        panelLayout.height = bounds.height;

        d.updatedAt = new Date().toISOString();
      });
    },
  });
