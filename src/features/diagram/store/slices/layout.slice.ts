import type { Point } from "../../model/diagram.types";
import type { AppState } from "../store.types";
import { pushHistory } from "./history.slice";
import { getActiveDiagram, touchDiagram } from "./get-active-diagram";
import {
  getActiveComponents,
  getActiveNodeLayouts,
  resolveActiveScene,
  resolveNodeLayout,
} from "./scene-helpers";
import { computeFitBounds } from "../../utils/fit-group-to-children";

export const layoutSlice = (
    set: (fn: (state: AppState) => void) => void,
    _get: () => AppState,
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
        const existing = diagram.edgeLayouts[connectionId];
        if (existing) {
          existing.waypoints = waypoints;
        } else {
          diagram.edgeLayouts[connectionId] = { waypoints };
        }
      });
    },

    clearEdgeWaypoints: (diagramId: string, connectionId: string) => {
      set((state) => {
        const diagram = state.diagrams[diagramId];
        if (!diagram?.edgeLayouts) return;
        delete diagram.edgeLayouts[connectionId];
      });
    },

    updateEdgeLabelOffset: (diagramId: string, connectionId: string, offset: number) => {
      set((state) => {
        const diagram = state.diagrams[diagramId];
        if (!diagram) return;
        const safe = Math.max(0, Math.min(1, offset));
        const existing = diagram.edgeLayouts[connectionId];
        if (existing) {
          existing.labelOffset = safe;
        } else {
          diagram.edgeLayouts[connectionId] = { waypoints: [], labelOffset: safe };
        }
      });
    },

    bringToFront: (elementId: string) => {
      set((state) => {
        const d = getActiveDiagram(state);
        if (!d) return;
        const scene = resolveActiveScene(d);
        if (scene && scene.addedComponents[elementId]) {
          const merged = { ...d.nodeLayouts, ...scene.nodeLayouts };
          const vals = Object.values(merged).map((nl) => nl.zIndex ?? 0);
          const maxZ = vals.length > 0 ? Math.max(...vals) : 0;
          const layout = resolveNodeLayout(d, scene, elementId);
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
        const scene = resolveActiveScene(d);
        if (scene && scene.addedComponents[elementId]) {
          const merged = { ...d.nodeLayouts, ...scene.nodeLayouts };
          const vals = Object.values(merged).map((nl) => nl.zIndex ?? 0);
          const minZ = vals.length > 0 ? Math.min(...vals) : 0;
          const layout = resolveNodeLayout(d, scene, elementId);
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
        const activeComponents = getActiveComponents(d, scene);
        const activeNodeLayouts = getActiveNodeLayouts(d, scene);
        const layouts = scene ? { ...d.nodeLayouts, ...activeNodeLayouts } : activeNodeLayouts;
        const components = scene ? { ...d.snapshot.components, ...activeComponents } : activeComponents;

        
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
          const layoutTarget = scene?.addedComponents[comp.id] ? activeNodeLayouts : d.nodeLayouts;
          const childLayout = layoutTarget[comp.id];
          if (childLayout) {
            childLayout.x -= dx;
            childLayout.y -= dy;
          }
        }

        
        const panelLayoutTarget = scene?.addedComponents[panelId] ? activeNodeLayouts : d.nodeLayouts;
        const panelLayout = panelLayoutTarget[panelId];
        if (!panelLayout) return;

        panelLayout.x += dx;
        panelLayout.y += dy;
        panelLayout.width  = bounds.width;
        panelLayout.height = bounds.height;

        touchDiagram(d);
      });
    },

    applyAutoLayout: (layouts: Array<{ elementId: string; x: number; y: number }>) => {
      set((state) => {
        const d = getActiveDiagram(state);
        if (!d || layouts.length === 0) return;

        pushHistory(state);

        const scene = resolveActiveScene(d);

        for (const { elementId, x, y } of layouts) {
          if (scene && scene.nodeLayouts[elementId]) {
            const layout = scene.nodeLayouts[elementId];
            if (layout) {
              layout.x = x;
              layout.y = y;
            }
            continue;
          }
          const layout = d.nodeLayouts[elementId];
          if (layout) {
            layout.x = x;
            layout.y = y;
          }
        }

        touchDiagram(d);
      });
    },
  });
