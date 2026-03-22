import type { AppState } from "../store.types";
import { pushHistory } from "./history.slice";

export const layoutSlice = (
    set: (fn: (state: AppState) => void) => void,
    get: () => AppState,
) => ({
    updateNodeLayout: (elementId: string, position: { x: number; y: number }, dimensions?: { width: number; height: number }) => {
      set((state) => {
        const d = state.diagrams[state.activeDiagramId!];
        const sid = d.activeSceneId ?? null;
        const scene = sid && d.scenes?.[sid] ? d.scenes[sid] : null;
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
        state.diagrams[state.activeDiagramId!].viewport = viewport;
      });
    },

    bringToFront: (elementId: string) => {
      set((state) => {
        const d = state.diagrams[state.activeDiagramId!];
        const sid = d.activeSceneId ?? null;
        const scene = sid && d.scenes?.[sid] ? d.scenes[sid] : null;
        if (scene && scene.addedComponents[elementId]) {
          const merged = { ...d.nodeLayouts, ...scene.nodeLayouts };
          const maxZ = Math.max(...Object.values(merged).map((nl) => nl.zIndex ?? 0));
          const layout = scene.nodeLayouts[elementId];
          if (layout) layout.zIndex = maxZ + 1;
          return;
        }
        pushHistory(state);
        const maxZ = Math.max(...Object.values(d.nodeLayouts).map((nl) => nl.zIndex ?? 0));
        const layout = d.nodeLayouts[elementId];
        if (layout) layout.zIndex = maxZ + 1;
      });
    },

    sendToBack: (elementId: string) => {
      set((state) => {
        const d = state.diagrams[state.activeDiagramId!];
        const sid = d.activeSceneId ?? null;
        const scene = sid && d.scenes?.[sid] ? d.scenes[sid] : null;
        if (scene && scene.addedComponents[elementId]) {
          const merged = { ...d.nodeLayouts, ...scene.nodeLayouts };
          const minZ = Math.min(...Object.values(merged).map((nl) => nl.zIndex ?? 0));
          const layout = scene.nodeLayouts[elementId];
          if (layout) layout.zIndex = minZ - 1;
          return;
        }
        pushHistory(state);
        const minZ = Math.min(...Object.values(d.nodeLayouts).map((nl) => nl.zIndex ?? 0));
        const layout = d.nodeLayouts[elementId];
        if (layout) layout.zIndex = minZ - 1;
      });
    },
  });
