import type { Component, Diagram, PanelComponent, SceneDiff } from "../../model/diagram.types";
import { PanelKind } from "../../enums";
import { generateId } from "../../utils/generate-id";
import { isApiGroupComponent, isPanelComponent } from "../../model/component.guards";
import {
  DEFAULT_NODE_H,
  DEFAULT_NODE_W,
  NODE_DRAG_PADDING,
  PANEL_DEFAULT_H,
  PANEL_DEFAULT_W,
} from "../../model/layout.constants";
import i18n from "@/infrastructure/i18n";
import type { AppState } from "../store.types";
import { STRUCTURAL_MUTATION_MARKER } from "../store.constants";
import { getActiveDiagram } from "./get-active-diagram";
import { pushHistory } from "./history.slice";
import { resolveActiveScene } from "./scene-helpers";

export const componentParentingSlice = (
  set: (fn: (state: AppState) => void) => void,
  _get: () => AppState,
) => ({
  setParent: (childId: string, parentId: string | null) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const scene = resolveActiveScene(d);
      if (scene && !scene.addedComponents[childId]) return;
      if (!scene) pushHistory(state, STRUCTURAL_MUTATION_MARKER);
      if (scene) {
        const comp = scene.addedComponents[childId];
        if (comp) comp.parentId = parentId;
      } else {
        const comp = d.snapshot.components[childId];
        if (comp) comp.parentId = parentId;
      }
    });
  },

  /**
   * Atomic drag-commit: pushes ONE history entry then applies parentId + position
   * in the same Immer transaction. Use this from onNodeDragStop instead of calling
   * setParent + updateNodeLayout separately to avoid the double-history / stale-position bug.
   */
  commitNodeDrag: (
    nodeId: string,
    newParentId: string | null,
    newPosition: { x: number; y: number },
  ) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const scene = resolveActiveScene(d);

      // Scene-mode guard: only allow moving scene-owned components
      if (scene && !scene.addedComponents[nodeId]) return;

      // Single pushHistory for the whole drag operation
      if (!scene) pushHistory(state, STRUCTURAL_MUTATION_MARKER);

      // Bug 5: Split scene / non-scene branches explicitly so the snapshot
      // can never be mutated when scene mode is active.
      if (scene) {
        // 1. Update parentId in scene
        const comp = scene.addedComponents[nodeId];
        if (comp) comp.parentId = newParentId;
        // 2. Update position in scene
        const layout = scene.nodeLayouts[nodeId];
        if (layout) {
          layout.x = newPosition.x;
          layout.y = newPosition.y;
        }
      } else {
        // 1. Update parentId in base snapshot
        const comp = d.snapshot.components[nodeId];
        if (comp) comp.parentId = newParentId;
        // 2. Update position in base layouts
        const layout = d.nodeLayouts[nodeId];
        if (layout) {
          layout.x = newPosition.x;
          layout.y = newPosition.y;
        }
      }

      d.updatedAt = new Date().toISOString();
    });
  },

  /**
   * Bug 3: Batch variant of commitNodeDrag — applies multiple node drag commits
   * in a single Immer transaction with ONE pushHistory entry.
   * Used for multi-select drag so undo reverts all nodes at once.
   */
  batchCommitNodeDrag: (
    entries: Array<{
      nodeId: string;
      newParentId: string | null;
      newPosition: { x: number; y: number };
    }>,
  ) => {
    if (entries.length === 0) return;
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const scene = resolveActiveScene(d);

      if (!scene) pushHistory(state, STRUCTURAL_MUTATION_MARKER);

      for (const { nodeId, newParentId, newPosition } of entries) {
        if (scene && !scene.addedComponents[nodeId]) continue;

        if (scene) {
          const comp = scene.addedComponents[nodeId];
          if (comp) comp.parentId = newParentId;
          const layout = scene.nodeLayouts[nodeId];
          if (layout) {
            layout.x = newPosition.x;
            layout.y = newPosition.y;
          }
        } else {
          const comp = d.snapshot.components[nodeId];
          if (comp) comp.parentId = newParentId;
          const layout = d.nodeLayouts[nodeId];
          if (layout) {
            layout.x = newPosition.x;
            layout.y = newPosition.y;
          }
        }
      }

      d.updatedAt = new Date().toISOString();
    });
  },

  groupNodes: (componentIds: string[]): string | null => {
    let panelId: string | null = null;
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      if (d.activeSceneId && d.scenes?.[d.activeSceneId]) return;
      const comps = d.snapshot.components;
      const ids = componentIds.filter(
        (id) => comps[id] && !isApiGroupComponent(comps[id]),
      );
      if (ids.length < 2) return;

      pushHistory(state, STRUCTURAL_MUTATION_MARKER);

      function getAbsPos(eid: string): { x: number; y: number } {
        const layout = d.nodeLayouts[eid];
        const c = comps[eid];
        if (!c || !layout) return { x: 0, y: 0 };
        if (!c.parentId) return { x: layout.x, y: layout.y };
        const parentPos = getAbsPos(c.parentId);
        return { x: parentPos.x + layout.x, y: parentPos.y + layout.y };
      }

      function getSize(eid: string): { w: number; h: number } {
        const layout = d.nodeLayouts[eid];
        if (layout?.width && layout?.height) {
          return { w: layout.width, h: layout.height };
        }
        const c = comps[eid];
        if (!c) return { w: DEFAULT_NODE_W, h: DEFAULT_NODE_H };
        if (isPanelComponent(c)) {
          return { w: layout?.width ?? PANEL_DEFAULT_W, h: layout?.height ?? PANEL_DEFAULT_H };
        }
        return { w: DEFAULT_NODE_W, h: 120 };
      }

      const positions = ids.map((id) => getAbsPos(id));
      const sizes = ids.map((id) => getSize(id));
      const minX = Math.min(...positions.map((p) => p.x)) - NODE_DRAG_PADDING;
      const minY = Math.min(...positions.map((p) => p.y)) - NODE_DRAG_PADDING;
      const maxX = Math.max(...positions.map((p, i) => p.x + sizes[i].w)) + NODE_DRAG_PADDING;
      const maxY = Math.max(...positions.map((p, i) => p.y + sizes[i].h)) + NODE_DRAG_PADDING * 2;

      const panel: PanelComponent = {
        id: generateId("el"),
        name: i18n.t("canvas.defaultGroupName"),
        type: "panel" as const,
        panelKind: PanelKind.Default,
        description: "",
        parentId: null,
      };
      d.snapshot.components[panel.id] = panel;
      d.nodeLayouts[panel.id] = { elementId: panel.id, x: minX, y: minY, zIndex: -1, width: maxX - minX, height: maxY - minY };
      panelId = panel.id;

      ids.forEach((eid, i) => {
        const comp = comps[eid];
        if (comp) comp.parentId = panel.id;
        const layout = d.nodeLayouts[eid];
        if (layout) {
          layout.x = positions[i].x - minX;
          layout.y = positions[i].y - minY;
        }
      });
      d.updatedAt = new Date().toISOString();
    });
    return panelId;
  },

  ungroupNodes: (panelId: string) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const scene = resolveActiveScene(d);

      if (scene) {
        if (!scene.addedComponents[panelId]) return;
        const panel = scene.addedComponents[panelId];
        if (!panel || !isPanelComponent(panel)) return;
        const panelLayout = scene.nodeLayouts[panelId];
        if (!panelLayout) return;
        const children = Object.values(scene.addedComponents).filter((c) => c.parentId === panelId);
        children.forEach((c) => {
          c.parentId = null;
          const childLayout = scene.nodeLayouts[c.id];
          if (childLayout) {
            childLayout.x = panelLayout.x + childLayout.x;
            childLayout.y = panelLayout.y + childLayout.y;
          }
        });
        delete scene.addedComponents[panelId];
        delete scene.nodeLayouts[panelId];
        d.updatedAt = new Date().toISOString();
        return;
      }

      const comps = d.snapshot.components;
      const panel = comps[panelId];
      if (!panel || !isPanelComponent(panel)) return;
      const children = Object.values(comps).filter((c) => c.parentId === panelId);
      const panelLayout = d.nodeLayouts[panelId];
      if (!panelLayout) return;
      pushHistory(state, STRUCTURAL_MUTATION_MARKER);
      children.forEach((c) => {
        c.parentId = null;
        const childLayout = d.nodeLayouts[c.id];
        if (childLayout) {
          childLayout.x = panelLayout.x + childLayout.x;
          childLayout.y = panelLayout.y + childLayout.y;
        }
      });
      delete d.snapshot.components[panelId];
      delete d.nodeLayouts[panelId];
      d.updatedAt = new Date().toISOString();
    });
  },
});
