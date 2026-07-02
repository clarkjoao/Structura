import type { Diagram, PanelComponent, SceneDiff } from "../../model/diagram.types";
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
import { getActiveDiagram, touchDiagram } from "./get-active-diagram";
import { pushHistory } from "./history.slice";
import {
  getActiveComponents,
  getActiveNodeLayouts,
  resolveActiveScene,
  resolveComponent,
  resolveNodeLayout,
} from "./scene-helpers";

function applySingleNodeDrag(
  d: Diagram,
  scene: SceneDiff | null,
  nodeId: string,
  newParentId: string | null,
  newPosition: { x: number; y: number },
): boolean {
  if (scene && !scene.addedComponents[nodeId]) return false;
  const comp = resolveComponent(d, scene, nodeId);
  if (comp) comp.parentId = newParentId;
  const layout = resolveNodeLayout(d, scene, nodeId);
  if (layout) {
    layout.x = newPosition.x;
    layout.y = newPosition.y;
  }
  return true;
}

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
      const comp = resolveComponent(d, scene, childId);
      if (comp) comp.parentId = parentId;
    });
  },

  
  commitNodeDrag: (
    nodeId: string,
    newParentId: string | null,
    newPosition: { x: number; y: number },
  ) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const scene = resolveActiveScene(d);

      
      if (scene && !scene.addedComponents[nodeId]) return;

      
      if (!scene) pushHistory(state, STRUCTURAL_MUTATION_MARKER);

      
      
      applySingleNodeDrag(d, scene, nodeId, newParentId, newPosition);

      touchDiagram(d);
    });
  },

  
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

      const willApply = entries.some(({ nodeId }) => {
        if (scene && !scene.addedComponents[nodeId]) return false;
        return !!(resolveComponent(d, scene, nodeId) || resolveNodeLayout(d, scene, nodeId));
      });
      if (!willApply) return;

      if (!scene) pushHistory(state, STRUCTURAL_MUTATION_MARKER);

      for (const { nodeId, newParentId, newPosition } of entries) {
        applySingleNodeDrag(d, scene, nodeId, newParentId, newPosition);
      }

      touchDiagram(d);
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
      touchDiagram(d);
    });
    return panelId;
  },

  ungroupNodes: (panelId: string) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const scene = resolveActiveScene(d);
      const activeComponents = getActiveComponents(d, scene);
      const activeNodeLayouts = getActiveNodeLayouts(d, scene);

      if (scene) {
        if (!scene.addedComponents[panelId]) return;
        const panel = activeComponents[panelId];
        if (!panel || !isPanelComponent(panel)) return;
        const panelLayout = activeNodeLayouts[panelId];
        if (!panelLayout) return;
        const children = Object.values(activeComponents).filter((c) => c.parentId === panelId);
        children.forEach((c) => {
          c.parentId = null;
          const childLayout = activeNodeLayouts[c.id];
          if (childLayout) {
            childLayout.x = panelLayout.x + childLayout.x;
            childLayout.y = panelLayout.y + childLayout.y;
          }
        });
        delete scene.addedComponents[panelId];
        delete scene.nodeLayouts[panelId];
        touchDiagram(d);
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
      touchDiagram(d);
    });
  },
});
