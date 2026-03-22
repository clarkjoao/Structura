import type { Component, Connection, Diagram, NodeLayout, SceneDiff } from "../../model/diagram.types";
import { generateId } from "../../utils/generate-id";
import type { AppState } from "../store.types";
import { nextSceneColor } from "../../utils/scene.utils";
import { mutateRemoveComponentInScene, mutateRemoveConnectionInScene } from "../../utils/scene-mutations";

function ensureScenes(d: Diagram): Record<string, SceneDiff> {
  if (!d.scenes) d.scenes = {};
  return d.scenes;
}

export const scenesSlice = (set: (fn: (state: AppState) => void) => void) => ({
  addScene: (name: string): SceneDiff => {
    let created!: SceneDiff;
    set((state) => {
      const d = state.diagrams[state.activeDiagramId!];
      if (!d) return;
      const scenes = ensureScenes(d);
      const index = Object.keys(scenes).length;
      const id = generateId("scene");
      created = {
        id,
        name: name.trim() || `Cena ${index + 1}`,
        color: nextSceneColor(index),
        createdAt: new Date().toISOString(),
        addedComponents: {},
        addedConnections: {},
        removedComponentIds: [],
        removedConnectionIds: [],
        nodeLayouts: {},
      };
      scenes[id] = created;
      d.updatedAt = new Date().toISOString();
    });
    return created;
  },

  removeScene: (sceneId: string) => {
    set((state) => {
      const d = state.diagrams[state.activeDiagramId!];
      if (!d?.scenes?.[sceneId]) return;
      delete d.scenes[sceneId];
      if (Object.keys(d.scenes).length === 0) {
        d.scenes = undefined;
      }
      if (d.activeSceneId === sceneId) {
        d.activeSceneId = null;
      }
      d.updatedAt = new Date().toISOString();
    });
  },

  setActiveScene: (sceneId: string | null) => {
    set((state) => {
      const d = state.diagrams[state.activeDiagramId!];
      if (!d) return;
      if (sceneId !== null && !d.scenes?.[sceneId]) return;

      const prev = d.activeSceneId ?? null;
      const vp = { ...d.viewport };
      if (prev && d.scenes?.[prev]) {
        d.scenes[prev].viewport = vp;
      }

      d.activeSceneId = sceneId;

      if (sceneId && d.scenes?.[sceneId]?.viewport) {
        const next = d.scenes[sceneId].viewport!;
        d.viewport = { x: next.x, y: next.y, zoom: next.zoom };
      }
      d.updatedAt = new Date().toISOString();
    });
  },

  renameScene: (sceneId: string, name: string) => {
    set((state) => {
      const d = state.diagrams[state.activeDiagramId!];
      const sc = d?.scenes?.[sceneId];
      if (!sc) return;
      const t = name.trim();
      if (t) sc.name = t;
      d.updatedAt = new Date().toISOString();
    });
  },

  addComponentToScene: (sceneId: string, component: Component, layout: NodeLayout) => {
    set((state) => {
      const d = state.diagrams[state.activeDiagramId!];
      const sc = d?.scenes?.[sceneId];
      if (!sc) return;
      sc.addedComponents[component.id] = component;
      sc.nodeLayouts[component.id] = { ...layout, elementId: component.id };
      d.updatedAt = new Date().toISOString();
    });
  },

  removeComponentFromScene: (sceneId: string, componentId: string) => {
    set((state) => {
      const d = state.diagrams[state.activeDiagramId!];
      if (!d?.scenes?.[sceneId]) return;
      mutateRemoveComponentInScene(d, sceneId, componentId);
      d.updatedAt = new Date().toISOString();
    });
  },

  addConnectionToScene: (sceneId: string, connection: Connection) => {
    set((state) => {
      const d = state.diagrams[state.activeDiagramId!];
      const sc = d?.scenes?.[sceneId];
      if (!sc) return;
      sc.addedConnections[connection.id] = connection;
      d.updatedAt = new Date().toISOString();
    });
  },

  removeConnectionFromScene: (sceneId: string, connectionId: string) => {
    set((state) => {
      const d = state.diagrams[state.activeDiagramId!];
      if (!d?.scenes?.[sceneId]) return;
      mutateRemoveConnectionInScene(d, sceneId, connectionId);
      d.updatedAt = new Date().toISOString();
    });
  },

  updateSceneNodeLayout: (
    sceneId: string,
    elementId: string,
    position: { x: number; y: number },
    dimensions?: { width: number; height: number },
  ) => {
    set((state) => {
      const d = state.diagrams[state.activeDiagramId!];
      const sc = d?.scenes?.[sceneId];
      if (!sc) return;
      const layout = sc.nodeLayouts[elementId];
      if (!layout) return;
      layout.x = position.x;
      layout.y = position.y;
      if (dimensions) {
        layout.width = dimensions.width;
        layout.height = dimensions.height;
      }
      d.updatedAt = new Date().toISOString();
    });
  },
});
