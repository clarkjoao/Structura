import type { Component, Connection, Diagram, NodeLayout, SceneDiff } from "../../model/diagram.types";
import { generateId } from "../../utils/generate-id";
import type { AppState } from "../store.types";
import { computeMergePreview, nextSceneColor } from "../../utils/scene.utils";
import { mutateRemoveComponentInScene, mutateRemoveConnectionInScene } from "../../utils/scene-mutations";
import { pushHistory } from "./history.slice";
import { getActiveDiagram } from "./get-active-diagram";
import { resolveActiveScene } from "./scene-helpers";
import i18n from "@/infrastructure/i18n";

function ensureScenes(d: Diagram): Record<string, SceneDiff> {
  if (!d.scenes) d.scenes = {};
  return d.scenes;
}

export const scenesSlice = (
  set: (fn: (state: AppState) => void) => void,
  _get: () => AppState,
) => ({
  duplicateScene: (sceneId: string, name?: string): SceneDiff | null => {
    let created: SceneDiff | null = null;
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const src = d?.scenes?.[sceneId];
      if (!src) return;
      const scenes = ensureScenes(d);
      const index = Object.keys(scenes).length;
      const id = generateId("scene");
      const copy = structuredClone(src) as SceneDiff;
      copy.id = id;
      const baseName = name?.trim() || i18n.t("scenes.duplicatedSceneName", { name: src.name });
      copy.name = baseName;
      copy.createdAt = new Date().toISOString();
      copy.color = nextSceneColor(index);
      scenes[id] = copy;
      created = copy;
      d.updatedAt = new Date().toISOString();
    });
    return created;
  },

  addScene: (name: string): SceneDiff => {
    let created!: SceneDiff;
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const scenes = ensureScenes(d);
      const index = Object.keys(scenes).length;
      const id = generateId("scene");
      created = {
        id,
        name: name.trim() || i18n.t("scenes.numberedDefaultName", { number: index + 1 }),
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
      const d = getActiveDiagram(state);
      if (!d?.scenes?.[sceneId]) return;
      delete d.scenes[sceneId];
      if (Object.keys(d.scenes).length === 0) {
        d.scenes = undefined;
      }
      if (d.activeSceneId === sceneId) {
        d.activeSceneId = null;
      }
      if (d.compareSceneId === sceneId) {
        d.compareSceneId = null;
      }
      d.updatedAt = new Date().toISOString();
    });
  },

  setActiveScene: (sceneId: string | null) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      if (sceneId !== null && !d.scenes?.[sceneId]) return;

      d.compareSceneId = null;

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

  setCompareScene: (sceneId: string | null) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      if (sceneId === null) {
        d.compareSceneId = null;
        d.updatedAt = new Date().toISOString();
        return;
      }
      const activeScene = resolveActiveScene(d);
      if (!activeScene) return;
      if (sceneId === activeScene.id) return;
      if (!d.scenes?.[sceneId]) return;
      d.compareSceneId = sceneId;
      d.updatedAt = new Date().toISOString();
    });
  },

  renameScene: (sceneId: string, name: string) => {
    set((state) => {
      const d = getActiveDiagram(state);
      const sc = d?.scenes?.[sceneId];
      if (!sc) return;
      const t = name.trim();
      if (t) sc.name = t;
      d.updatedAt = new Date().toISOString();
    });
  },

  mergeSceneIntoBase: (sceneId: string) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d?.scenes?.[sceneId]) return;
      let preview: ReturnType<typeof computeMergePreview>;
      try {
        preview = computeMergePreview(d, sceneId);
      } catch {
        return;
      }

      pushHistory(state);

      for (const comp of preview.componentsToAdd) {
        d.snapshot.components[comp.id] = comp;
      }
      for (const conn of preview.connectionsToAdd) {
        d.snapshot.connections[conn.id] = conn;
      }
      Object.assign(d.nodeLayouts, preview.layoutsToAdd);

      for (const id of preview.componentIdsToRemove) {
        delete d.snapshot.components[id];
        delete d.nodeLayouts[id];
      }
      for (const id of preview.connectionIdsToRemove) {
        delete d.snapshot.connections[id];
      }

      const removeCompSet = new Set(preview.componentIdsToRemove);
      const removeConnSet = new Set(preview.connectionIdsToRemove);
      const scenesMap = d.scenes!;

      for (const other of Object.values(scenesMap)) {
        if (other.id === sceneId) continue;
        other.removedComponentIds = other.removedComponentIds.filter((id) => !removeCompSet.has(id));
        other.removedConnectionIds = other.removedConnectionIds.filter((id) => !removeConnSet.has(id));
        for (const comp of preview.componentsToAdd) {
          if (other.addedComponents[comp.id]) {
            delete other.addedComponents[comp.id];
            delete other.nodeLayouts[comp.id];
          }
        }
        for (const conn of preview.connectionsToAdd) {
          if (other.addedConnections[conn.id]) {
            delete other.addedConnections[conn.id];
          }
        }
      }

      delete scenesMap[sceneId];
      if (Object.keys(scenesMap).length === 0) {
        d.scenes = undefined;
      }
      if (d.activeSceneId === sceneId) {
        d.activeSceneId = null;
      }
      if (d.compareSceneId === sceneId) {
        d.compareSceneId = null;
      }
      d.updatedAt = new Date().toISOString();
    });
  },

  addComponentToScene: (sceneId: string, component: Component, layout: NodeLayout) => {
    set((state) => {
      const d = getActiveDiagram(state);
      const sc = d?.scenes?.[sceneId];
      if (!sc) return;
      sc.addedComponents[component.id] = component;
      sc.nodeLayouts[component.id] = { ...layout, elementId: component.id };
      d.updatedAt = new Date().toISOString();
    });
  },

  removeComponentFromScene: (sceneId: string, componentId: string) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d?.scenes?.[sceneId]) return;
      mutateRemoveComponentInScene(d, sceneId, componentId);
      d.updatedAt = new Date().toISOString();
    });
  },

  addConnectionToScene: (sceneId: string, connection: Connection) => {
    set((state) => {
      const d = getActiveDiagram(state);
      const sc = d?.scenes?.[sceneId];
      if (!sc) return;
      sc.addedConnections[connection.id] = connection;
      d.updatedAt = new Date().toISOString();
    });
  },

  removeConnectionFromScene: (sceneId: string, connectionId: string) => {
    set((state) => {
      const d = getActiveDiagram(state);
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
      const d = getActiveDiagram(state);
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
