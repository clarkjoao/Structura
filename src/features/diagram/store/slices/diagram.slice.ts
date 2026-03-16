import { SEED_DIAGRAMS } from "@/fixtures/seed";
import { AppState } from "../store.types";
import {Diagram, Level} from "../../model/diagram.types";
import { generateId } from "../../utils/generate-id";

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
  
    deleteDiagram: (id: string) => {
      set((state) => {
        delete state.diagrams[id];
  
        if (state.activeDiagramId === id)
          state.activeDiagramId = null;
      });
    },
  });