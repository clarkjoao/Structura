import type { AppState } from "../store.types";
import { pushHistory } from "./history.slice";
import { touchDiagram } from "../helpers/get-active-diagram";

function clearCustomIconIdFromComponents(
  record: Record<string, { customIconId?: string }>,
  iconId: string,
): void {
  for (const comp of Object.values(record)) {
    if (comp.customIconId === iconId) {
      comp.customIconId = undefined;
    }
  }
}

/**
 * Removes all customIconId references to a deleted icon from a diagram's components and scenes.
 * The actual icon CRUD lives in the global icon-store (icon-store.ts).
 * This slice only handles the reference cleanup.
 */
export const iconsSlice = (set: (fn: (state: AppState) => void) => void, _get: () => AppState) => ({
  removeIconReferences: (diagramId: string, iconId: string): void => {
    set((state) => {
      const diagram = state.diagrams[diagramId];
      if (!diagram) {
        return;
      }
      if (state.activeDiagramId === diagramId) {
        pushHistory(state);
      }
      clearCustomIconIdFromComponents(diagram.snapshot.components, iconId);
      if (diagram.scenes) {
        for (const scene of Object.values(diagram.scenes)) {
          clearCustomIconIdFromComponents(scene.addedComponents, iconId);
        }
      }
      touchDiagram(diagram);
    });
  },
});
