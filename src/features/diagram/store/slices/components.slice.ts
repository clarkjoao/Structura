import type { Component, ComponentPatch, ComponentType, PanelComponent, PanelKind } from "../../model/diagram.types";
import { generateId } from "../../model/diagram.utils";
import { isPanelComponent } from "../../model/component.guards";
import { getPanelKindDef } from "@/lib/panel-catalog";
import type { AppState } from "../store.types";
import { activeDiagram } from "../store.types";
import { pushHistory } from "./history.slice";
import {
  PANEL_DEFAULT_W,
  PANEL_DEFAULT_H,
  NOTE_DEFAULT_W,
  NOTE_DEFAULT_H,
  NODE_DRAG_PADDING,
  DEFAULT_NODE_W,
  DEFAULT_NODE_H,
} from "@/features/canvas/constants";

export function componentsSlice(set: (fn: (state: AppState) => void) => void) {
  return {
    addComponent: (
      type: ComponentType,
      name: string,
      parentId: string | null,
      position?: { x: number; y: number },
      awsService?: string,
      panelKind?: PanelKind,
    ): Component => {
      const base = { id: generateId("el"), name, description: "", parentId };
      let component: Component;
      if (type === "panel") {
        const kind = panelKind ?? "default";
        const def = getPanelKindDef(kind);
        component = {
          ...base,
          type: "panel",
          panelKind: kind,
          panelColor: def.defaultColor,
        } as PanelComponent;
      } else if (type === "note") {
        component = { ...base, type: "note", panelColor: "hsl(45 25% 97%)" };
      } else if (type === "person" || type === "system" || type === "container" || type === "component") {
        component = { ...base, type };
      } else {
        // AWS type
        component = { ...base, type, awsService: awsService ?? undefined };
      }
      set((state) => {
        pushHistory(state);
        const d = activeDiagram(state);
        d.snapshot.components[component.id] = component;
        d.nodeLayouts.push({
          elementId: component.id,
          x: position?.x ?? 300,
          y: position?.y ?? 300,
          ...(type === "panel" ? { zIndex: -1, width: PANEL_DEFAULT_W, height: PANEL_DEFAULT_H } : {}),
          ...(type === "note" ? { width: NOTE_DEFAULT_W, height: NOTE_DEFAULT_H } : {}),
        });
        d.updatedAt = "agora";
      });
      return component;
    },

    updateComponent: (id: string, patch: ComponentPatch) => {
      const patchAny = patch as Record<string, unknown>;
      const width = patchAny.width as number | undefined;
      const height = patchAny.height as number | undefined;
      const hasDimensions = width !== undefined || height !== undefined;
      const isDimensionOnly = hasDimensions && Object.keys(patch).every((k) => k === "width" || k === "height");
      // Build component patch without width/height
      const compPatch: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(patchAny)) {
        if (k !== "width" && k !== "height") compPatch[k] = v;
      }
      set((state) => {
        if (!isDimensionOnly) pushHistory(state);
        const d = activeDiagram(state);
        if (Object.keys(compPatch).length > 0) {
          Object.assign(d.snapshot.components[id], compPatch);
        }
        if (hasDimensions) {
          const layout = d.nodeLayouts.find((nl) => nl.elementId === id);
          if (layout) {
            if (width !== undefined) layout.width = width;
            if (height !== undefined) layout.height = height;
          }
        }
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

    updateHandleOrder: (
      componentId: string,
      side: "incoming" | "outgoing",
      orderedConnectionIds: string[],
    ) => {
      set((state) => {
        const d = activeDiagram(state);
        const comp = d.snapshot.components[componentId];
        if (!comp) return;
        if (!comp.handleOrder) comp.handleOrder = { incoming: [], outgoing: [] };
        comp.handleOrder[side] = orderedConnectionIds;
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
      let panelId: string | null = null;
      set((state) => {
        const d = activeDiagram(state);
        const comps = d.snapshot.components;
        const ids = componentIds.filter(
          (id) => comps[id] && !isPanelComponent(comps[id]),
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
          if (isPanelComponent(c)) {
            const layout = d.nodeLayouts.find((nl) => nl.elementId === eid);
            return { w: layout?.width ?? PANEL_DEFAULT_W, h: layout?.height ?? PANEL_DEFAULT_H };
          }
          return { w: DEFAULT_NODE_W, h: DEFAULT_NODE_H };
        }

        const positions = ids.map((id) => getAbsPos(id));
        const sizes = ids.map((id) => getSize(id));
        const minX = Math.min(...positions.map((p) => p.x)) - NODE_DRAG_PADDING;
        const minY = Math.min(...positions.map((p) => p.y)) - NODE_DRAG_PADDING;
        const maxX = Math.max(...positions.map((p, i) => p.x + sizes[i].w)) + NODE_DRAG_PADDING;
        const maxY = Math.max(...positions.map((p, i) => p.y + sizes[i].h)) + NODE_DRAG_PADDING;

        pushHistory(state);
        const panel: PanelComponent = {
          id: generateId("el"),
          name: "Grupo",
          type: "panel",
          panelKind: "default",
          description: "",
          parentId: null,
        };
        d.snapshot.components[panel.id] = panel;
        d.nodeLayouts.push({ elementId: panel.id, x: minX, y: minY, zIndex: -1, width: maxX - minX, height: maxY - minY });
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
        if (!panel || !isPanelComponent(panel)) return;
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

