import type { IconDefinition } from "../../model/diagram.types";
import type { AppState } from "../store.types";
import { pushHistory } from "./history.slice";
import { touchDiagram } from "./get-active-diagram";

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

export const iconsSlice = (set: (fn: (state: AppState) => void) => void, _get: () => AppState) => ({
  addIcon: (_diagramId: string, _icon: IconDefinition): void => {},

  removeIconReferences: (diagramId: string, iconId: string): void => {
    set((state) => {
      const diagram = state.diagrams[diagramId];
      if (!diagram) {
        return;
      }
      // Only push history if this is the active diagram
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

  removeIcon: (_diagramId: string, _iconId: string): void => {},

  updateIconName: (_diagramId: string, _iconId: string, _name: string): void => {},

  incrementIconUsage: (_diagramId: string, _iconId: string): void => {},

  decrementIconUsage: (_diagramId: string, _iconId: string): void => {},
});
