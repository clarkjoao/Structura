import { SEED_DIAGRAMS } from "@/fixtures/seeds";
import { AppState } from "../store.types";
import {Diagram, Level} from "../../model/diagram.types";
import { generateId } from "../../utils/generate-id";
import { touchDiagram } from "./get-active-diagram";

export const diagramsSlice = (
    set: (fn: (state: AppState) => void) => void,
    get: () => AppState,
) => ({
    diagrams: import.meta.env.VITE_DISABLE_SEEDS === "true" ? {} : SEED_DIAGRAMS,
    activeDiagramId: null as string | null,
  
    addDiagram: (
      name: string,
      level: Level,
      domain?: string,
      folderId?: string | null,
      description?: string,
    ) => {
        const now = Date.now();
        const diagram: Diagram = {
          id: generateId("d"),
          name,
          level,
          domain: domain || undefined,
          description: description || undefined,
          createdAt: now,
          updatedAt: now,
          snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
          nodeLayouts: {},
          edgeLayouts: {},
          viewport: { x: 0, y: 0, zoom: 1 },
          folderId: folderId ?? undefined,
        };
        set((state) => { state.diagrams[diagram.id] = diagram; });

        return diagram;
      },

    addImportedDiagram: (diagramInput: Diagram) => {
      const importedDiagram: Diagram = {
        ...structuredClone(diagramInput),
      };

      set((state) => {
        state.diagrams[importedDiagram.id] = importedDiagram;
      });

      return importedDiagram;
    },

    importDiagram: (diagramInput: Diagram) => {
      const now = Date.now();
      const importedDiagram: Diagram = {
        ...structuredClone(diagramInput),
        id: generateId("d"),
        createdAt: now,
        updatedAt: now,
      };

      set((state) => {
        state.diagrams[importedDiagram.id] = importedDiagram;
      });

      return importedDiagram;
    },

    duplicateDiagram: (sourceId: string, name: string) => {
      const source = get().diagrams[sourceId];
      if (!source) return null;
      const newId = generateId("d");
      const now = Date.now();
      const diagram: Diagram = {
        ...structuredClone(source),
        id: newId,
        name: name.trim() || source.name,
        createdAt: now,
        updatedAt: now,
      };
      set((state) => {
        state.diagrams[newId] = diagram;
      });
      return diagram;
    },
  
    openDiagram: (id: string) => {
      set((state) => {
        state.activeDiagramId = id;
        // Undo/redo history is scoped to the current editing session and should not
        // survive diagram switches to avoid cross-diagram contamination.
        state.past = [];
        state.future = [];
      });
    },
  
    updateDiagram: (id: string, patch: { name?: string; domain?: string }) => {
      set((s) => {
        const d = s.diagrams[id];
        if (!d) return;
        if (patch.name !== undefined) d.name = patch.name.trim() || d.name;
        if (patch.domain !== undefined) d.domain = patch.domain;
        touchDiagram(d);
      });
    },

    updateDiagramDescription: (diagramId: string, description: string) => {
      set((state) => {
        const diagram = state.diagrams[diagramId];
        if (!diagram) return;
        diagram.description = description;
        touchDiagram(diagram);
      });
    },

    deleteDiagram: (id: string) => {
      set((s) => {
        delete s.diagrams[id];

        if (s.activeDiagramId === id)
          s.activeDiagramId = null;
        s.past = s.past.filter((entry) => entry.diagramId !== id);
        s.future = s.future.filter((entry) => entry.diagramId !== id);
      });
    },
  });
