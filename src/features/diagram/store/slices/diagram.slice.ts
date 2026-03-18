import { SEED_DIAGRAMS } from "@/fixtures/seed";
import { AppState } from "../store.types";
import {Diagram, Level} from "../../model/diagram.types";
import { generateId } from "../../utils/generate-id";
import { fileSystemAdapter } from "@/infrastructure/persistence";

export const diagramsSlice = (
    set: (fn: (state: AppState) => void) => void,
    get: () => AppState,
) => ({
    diagrams: SEED_DIAGRAMS,
    activeDiagramId: null,
  
    addDiagram: (name: string, level: Level, domain?: string, folderId?: string | null) => {
        const diagram: Diagram = {
          id: generateId("d"),
          name,
          level,
          domain: domain || undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          snapshot: { components: {}, connections: {}, flows: {} },
          nodeLayouts: {},
          viewport: { x: 0, y: 0, zoom: 1 },
          folderId: folderId ?? undefined,
        };
        set((state) => { state.diagrams[diagram.id] = diagram; });
        return diagram;
      },
  
    openDiagram: (id: string) => {
      set((state) => {
        state.activeDiagramId = id;
      });
    },
  
    updateDiagram: (id: string, patch: { name?: string; domain?: string }) => {
      set((s) => {
        const d = s.diagrams[id];
        if (!d) return;
        if (patch.name !== undefined) d.name = patch.name.trim() || d.name;
        if (patch.domain !== undefined) d.domain = patch.domain;
        d.updatedAt = new Date().toISOString();
      });
    },

    deleteDiagram: (id: string) => {
      const state = get();
      const diagram = state.diagrams[id];
      fileSystemAdapter.setFolders(state.folders);
      set((s) => {
        delete s.diagrams[id];

        if (s.activeDiagramId === id)
          s.activeDiagramId = null;
      });
      fileSystemAdapter.deleteDiagram(id, diagram);
    },
  });