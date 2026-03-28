import { useIconStore } from "@/features/icons/store";
import type { IconDefinition } from "../../model/diagram.types";
import type { AppState } from "../store.types";
import { pushHistory } from "./history.slice";

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

export const iconsSlice = (
  set: (fn: (state: AppState) => void) => void,
  _get: () => AppState,
) => ({
  addIcon: (_diagramId: string, icon: IconDefinition): void => {
    useIconStore.getState().addIcon(icon);
  },

  removeIcon: (diagramId: string, iconId: string): void => {
    useIconStore.getState().removeIcon(iconId);
    set((state) => {
      if (state.activeDiagramId === diagramId) {
        pushHistory(state);
      }
      const diagram = state.diagrams[diagramId];
      if (!diagram) {
        return;
      }
      clearCustomIconIdFromComponents(diagram.snapshot.components, iconId);
      if (diagram.scenes) {
        for (const scene of Object.values(diagram.scenes)) {
          clearCustomIconIdFromComponents(scene.addedComponents, iconId);
        }
      }
      diagram.updatedAt = new Date().toISOString();
    });
  },

  updateIconName: (_diagramId: string, iconId: string, name: string): void => {
    useIconStore.getState().updateIconName(iconId, name);
  },

  incrementIconUsage: (_diagramId: string, iconId: string): void => {
    useIconStore.getState().incrementIconUsage(iconId);
  },

  decrementIconUsage: (_diagramId: string, iconId: string): void => {
    useIconStore.getState().decrementIconUsage(iconId);
  },
});
