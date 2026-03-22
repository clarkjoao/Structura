import { SEED_DIAGRAMS } from "@/fixtures/seed";
import { deletePreview } from "@/lib/diagram-preview/previewCache";
import { AppState } from "../store.types";
import {Diagram, Level} from "../../model/diagram.types";
import { generateId } from "../../utils/generate-id";
import { fileSystemAdapter } from "@/infrastructure/persistence";
import { removeRecentRef } from "@/features/canvas/navigation/useRecentDiagrams";

export const diagramsSlice = (
    set: (fn: (state: AppState) => void) => void,
    get: () => AppState,
) => ({
    diagrams: import.meta.env.VITE_DISABLE_SEEDS === "true" ? {} : SEED_DIAGRAMS,
    activeDiagramId: null,
  
    addDiagram: (name: string, level: Level, domain?: string, folderId?: string | null) => {
        const diagram: Diagram = {
          id: generateId("d"),
          name,
          level,
          domain: domain || undefined,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          snapshot: { components: {}, connections: {}, flows: {}, iconLibrary: {} },
          nodeLayouts: {},
          viewport: { x: 0, y: 0, zoom: 1 },
          folderId: folderId ?? undefined,
        };
        set((state) => { state.diagrams[diagram.id] = diagram; });

        // Write immediately to connected folder so the diagram exists on disk
        // before any navigation (the debounced sync may not fire in time).
        if (fileSystemAdapter.isConnected) {
          fileSystemAdapter.setFolders(get().folders);
          fileSystemAdapter.writeDiagram(diagram);
        }

        return diagram;
      },

    duplicateDiagram: (sourceId: string, name: string) => {
      const source = get().diagrams[sourceId];
      if (!source) return null;
      const newId = generateId("d");
      const now = new Date().toISOString();
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
      if (fileSystemAdapter.isConnected) {
        fileSystemAdapter.setFolders(get().folders);
        fileSystemAdapter.writeDiagram(diagram);
      }
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

    updateDiagramDescription: (diagramId: string, description: string) => {
      set((state) => {
        const diagram = state.diagrams[diagramId];
        if (!diagram) return;
        diagram.description = description;
        diagram.updatedAt = new Date().toISOString();
      });
    },

    deleteDiagram: (id: string) => {
      deletePreview(id);
      const state = get();
      const diagram = state.diagrams[id];
      fileSystemAdapter.setFolders(state.folders);
      set((s) => {
        delete s.diagrams[id];

        if (s.activeDiagramId === id)
          s.activeDiagramId = null;
      });
      fileSystemAdapter.deleteDiagram(id, diagram);
      removeRecentRef(id);
    },
  });