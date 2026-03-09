import type { AppState } from "../store.types";
import { activeDiagram } from "../store.types";
import { pushHistory } from "./history.slice";

export function layoutSlice(set: (fn: (state: AppState) => void) => void) {
  return {
    updateNodeLayout: (elementId: string, position: { x: number; y: number }, dimensions?: { width: number; height: number }) => {
      set((state) => {
        const d = activeDiagram(state);
        const layout = d.nodeLayouts.find((nl) => nl.elementId === elementId);
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
        activeDiagram(state).viewport = viewport;
      });
    },

    bringToFront: (elementId: string) => {
      set((state) => {
        pushHistory(state);
        const d = activeDiagram(state);
        const maxZ = Math.max(...d.nodeLayouts.map((nl) => nl.zIndex ?? 0));
        const layout = d.nodeLayouts.find((nl) => nl.elementId === elementId);
        if (layout) layout.zIndex = maxZ + 1;
      });
    },

    sendToBack: (elementId: string) => {
      set((state) => {
        pushHistory(state);
        const d = activeDiagram(state);
        const minZ = Math.min(...d.nodeLayouts.map((nl) => nl.zIndex ?? 0));
        const layout = d.nodeLayouts.find((nl) => nl.elementId === elementId);
        if (layout) layout.zIndex = minZ - 1;
      });
    },
  };
}
