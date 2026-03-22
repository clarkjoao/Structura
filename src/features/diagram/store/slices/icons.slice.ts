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
  addIcon: (diagramId: string, icon: IconDefinition): void => {
    set((state) => {
      if (state.activeDiagramId === diagramId) {
        pushHistory(state);
      }
      const diagram = state.diagrams[diagramId];
      if (!diagram) return;
      if (!diagram.snapshot.iconLibrary) diagram.snapshot.iconLibrary = {};
      diagram.snapshot.iconLibrary[icon.id] = icon;
      diagram.updatedAt = new Date().toISOString();
    });
  },

  removeIcon: (diagramId: string, iconId: string): void => {
    set((state) => {
      if (state.activeDiagramId === diagramId) {
        pushHistory(state);
      }
      const diagram = state.diagrams[diagramId];
      if (!diagram?.snapshot.iconLibrary) return;
      delete diagram.snapshot.iconLibrary[iconId];
      clearCustomIconIdFromComponents(diagram.snapshot.components, iconId);
      if (diagram.scenes) {
        for (const scene of Object.values(diagram.scenes)) {
          clearCustomIconIdFromComponents(scene.addedComponents, iconId);
        }
      }
      diagram.updatedAt = new Date().toISOString();
    });
  },

  updateIconName: (diagramId: string, iconId: string, name: string): void => {
    set((state) => {
      if (state.activeDiagramId === diagramId) {
        pushHistory(state);
      }
      const diagram = state.diagrams[diagramId];
      const icon = diagram?.snapshot.iconLibrary?.[iconId];
      if (!icon) return;
      icon.name = name;
      diagram.updatedAt = new Date().toISOString();
    });
  },

  incrementIconUsage: (diagramId: string, iconId: string): void => {
    set((state) => {
      const diagram = state.diagrams[diagramId];
      if (!diagram?.snapshot.iconLibrary) return;
      const icon = diagram.snapshot.iconLibrary[iconId];
      if (!icon) return;
      icon.usageCount += 1;
      diagram.updatedAt = new Date().toISOString();
    });
  },

  decrementIconUsage: (diagramId: string, iconId: string): void => {
    set((state) => {
      const diagram = state.diagrams[diagramId];
      if (!diagram?.snapshot.iconLibrary) return;
      const icon = diagram.snapshot.iconLibrary[iconId];
      if (!icon) return;
      icon.usageCount = Math.max(0, icon.usageCount - 1);
      diagram.updatedAt = new Date().toISOString();
    });
  },
});
