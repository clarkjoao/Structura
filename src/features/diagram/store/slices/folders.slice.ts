import { SEED_FOLDERS } from "@/fixtures/seeds";
import type { Folder } from "../../model/diagram.types";
import { generateId } from "../../utils/generate-id";
import type { AppState } from "../store.types";

export function foldersSlice(
  set: (fn: (state: AppState) => void) => void,
  _get: () => AppState,
) {
  return {
  folders: import.meta.env.VITE_DISABLE_SEEDS === "true" ? {} : SEED_FOLDERS,

  addFolder: (name: string, parentId: string | null, domain?: string) => {
    const folder: Folder = {
      id: generateId("folder"),
      name,
      parentId,
      domain: domain || undefined,
    };

    set((state) => {
      state.folders[folder.id] = folder;
    });

    return folder;
  },

  renameFolder: (id: string, name: string) => {
    set((state) => {
      const folder = state.folders[id];
      if (!folder) return;

      folder.name = name;
    });
  },

  deleteFolder: (id: string) => {
    set((state) => {
      const hasChildren = Object.values(state.folders).some(
        (f) => f.parentId === id,
      );

      const hasDiagrams = Object.values(state.diagrams).some(
        (d) => d.folderId === id,
      );

      if (hasChildren || hasDiagrams) return;

      delete state.folders[id];
    });
  },

  moveDiagram: (diagramId: string, folderId: string | null) => {
    set((state) => {
      const diagram = state.diagrams[diagramId];
      if (!diagram) return;

      diagram.folderId = folderId ?? undefined;
    });
  },
  };
}