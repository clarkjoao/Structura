import type { Component, ComponentType } from "../../model/diagram.types";
import { generateId } from "../../model/diagram.utils";
import type { AppState } from "../store.types";
import { activeDiagram, } from "../store.types";
import { deepClone, pushHistory } from "./history.slice";

export function componentsSlice(set: (fn: (state: AppState) => void) => void) {
  return {
    addComponent: (
      type: ComponentType,
      name: string,
      parentId: string | null,
      position?: { x: number; y: number },
      awsService?: string,
    ): Component => {
      const component: Component = {
        id: generateId("el"),
        name,
        type,
        description: "",
        parentId,
        awsService: awsService ?? undefined,
        ...(type === "panel" ? { width: 600, height: 400 } : {}),
        ...(type === "note" ? { panelColor: "hsl(48 96% 53%)" } : {}),
      };
      set((state) => {
        pushHistory(state);
        const d = activeDiagram(state);
        d.snapshot.components[component.id] = component;
        d.nodeLayouts.push({
          elementId: component.id,
          x: position?.x ?? 300,
          y: position?.y ?? 300,
          ...(type === "panel" ? { zIndex: -1 } : {}),
        });
        d.updatedAt = "agora";
      });
      return component;
    },

    updateComponent: (id: string, patch: Partial<Omit<Component, "id">>) => {
      const isDimensionOnly = Object.keys(patch).every(
        (k) => k === "width" || k === "height",
      );
      set((state) => {
        if (!isDimensionOnly) pushHistory(state);
        const d = activeDiagram(state);
        Object.assign(d.snapshot.components[id], patch);
        d.updatedAt = "agora";
      });
    },

    removeComponent: (id: string) => {
      set((state) => {
        pushHistory(state);
        const d = activeDiagram(state);
        const toRemove = new Set<string>();
        const collect = (eid: string) => {
          toRemove.add(eid);
          Object.values(d.snapshot.components)
            .filter((c) => c.parentId === eid)
            .forEach((c) => collect(c.id));
        };
        collect(id);
        toRemove.forEach((eid) => delete d.snapshot.components[eid]);
        Object.values(d.snapshot.connections).forEach((conn) => {
          if (toRemove.has(conn.sourceId) || toRemove.has(conn.targetId))
            delete d.snapshot.connections[conn.id];
        });
        d.nodeLayouts = d.nodeLayouts.filter((nl) => !toRemove.has(nl.elementId));
        d.updatedAt = "agora";
      });
    },

    setParent: (childId: string, parentId: string | null) => {
      set((state) => {
        pushHistory(state);
        const comp = activeDiagram(state).snapshot.components[childId];
        if (comp) comp.parentId = parentId;
      });
    },

    groupNodes: (componentIds: string[]): string | null => {
      const PADDING = 40;
      const DEFAULT_NODE_W = 180;
      const DEFAULT_NODE_H = 80;
      let panelId: string | null = null;
      set((state) => {
        const d = activeDiagram(state);
        const comps = d.snapshot.components;
        const ids = componentIds.filter(
          (id) => comps[id] && comps[id].type !== "panel",
        );
        if (ids.length < 2) return;

        function getAbsPos(eid: string): { x: number; y: number } {
          const layout = d.nodeLayouts.find((nl) => nl.elementId === eid);
          const c = comps[eid];
          if (!c || !layout) return { x: 0, y: 0 };
          if (!c.parentId) return { x: layout.x, y: layout.y };
          const parentPos = getAbsPos(c.parentId);
          return { x: parentPos.x + layout.x, y: parentPos.y + layout.y };
        }

        function getSize(eid: string): { w: number; h: number } {
          const c = comps[eid];
          if (!c) return { w: DEFAULT_NODE_W, h: DEFAULT_NODE_H };
          if (c.type === "panel") return { w: c.width ?? 600, h: c.height ?? 400 };
          return {
            w: (c as { width?: number }).width ?? DEFAULT_NODE_W,
            h: (c as { height?: number }).height ?? DEFAULT_NODE_H,
          };
        }

        const positions = ids.map((id) => getAbsPos(id));
        const sizes = ids.map((id) => getSize(id));
        const minX = Math.min(...positions.map((p) => p.x)) - PADDING;
        const minY = Math.min(...positions.map((p) => p.y)) - PADDING;
        const maxX = Math.max(...positions.map((p, i) => p.x + sizes[i].w)) + PADDING;
        const maxY = Math.max(...positions.map((p, i) => p.y + sizes[i].h)) + PADDING;

        pushHistory(state);
        const panel: Component = {
          id: generateId("el"),
          name: "Grupo",
          type: "panel",
          description: "",
          parentId: null,
          width: maxX - minX,
          height: maxY - minY,
        };
        d.snapshot.components[panel.id] = panel;
        d.nodeLayouts.push({ elementId: panel.id, x: minX, y: minY, zIndex: -1 });
        panelId = panel.id;

        ids.forEach((eid, i) => {
          const comp = comps[eid];
          if (comp) comp.parentId = panel.id;
          const layout = d.nodeLayouts.find((nl) => nl.elementId === eid);
          if (layout) {
            layout.x = positions[i].x - minX;
            layout.y = positions[i].y - minY;
          }
        });
        d.updatedAt = "agora";
      });
      return panelId;
    },

    ungroupNodes: (panelId: string) => {
      set((state) => {
        const d = activeDiagram(state);
        const comps = d.snapshot.components;
        const panel = comps[panelId];
        if (!panel || panel.type !== "panel") return;
        const children = Object.values(comps).filter((c) => c.parentId === panelId);
        const panelLayout = d.nodeLayouts.find((nl) => nl.elementId === panelId);
        if (!panelLayout) return;
        pushHistory(state);
        children.forEach((c) => {
          c.parentId = null;
          const childLayout = d.nodeLayouts.find((nl) => nl.elementId === c.id);
          if (childLayout) {
            childLayout.x = panelLayout.x + childLayout.x;
            childLayout.y = panelLayout.y + childLayout.y;
          }
        });
        delete d.snapshot.components[panelId];
        d.nodeLayouts = d.nodeLayouts.filter((nl) => nl.elementId !== panelId);
        d.updatedAt = "agora";
      });
    },
  };
}
