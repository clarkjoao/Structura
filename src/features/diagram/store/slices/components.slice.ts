import type {
  Component,
  ComponentPatch,
  ComponentType,
  ApiGroupComponent,
  EndpointComponent,
  PanelComponent,
  NodeLayout,
  Diagram,
  SceneDiff,
} from "../../model/diagram.types";
import { PanelKind } from "../../enums";
import { generateId } from "../../utils/generate-id";
import { isPanelComponent, isApiGroupComponent } from "../../model/component.guards";
import { isPanelType, isNoteType, isEndpointType, isApiGroupType, isC4Type } from "../../model/component-type-constants";
import { getPanelKindDef } from "@/lib/catalogs/panels";
import type { AppState } from "../store.types";
import { pushHistory } from "./history.slice";
import { resolveActiveScene } from "./scene-helpers";
import {
  PANEL_DEFAULT_W,
  PANEL_DEFAULT_H,
  SWIMLANE_DEFAULT_W,
  SWIMLANE_DEFAULT_H,
  NOTE_DEFAULT_W,
  NOTE_DEFAULT_H,
  NODE_DRAG_PADDING,
  DEFAULT_NODE_W,
  DEFAULT_NODE_H,
} from "@/features/canvas/constants";
import i18n from "@/infrastructure/i18n";
import { HEADER_H, ENDPOINT_H, FRAME_W } from "@/features/canvas/nodes/ApiGroupNode/constants";
import { computeApiGroupSize } from "@/features/canvas/nodes/ApiGroupNode/useApiGroupSize";
import { mutateRemoveComponentInScene } from "../../utils/scene-mutations";

function handleEndpointInsertion(
  state: AppState,
  d: Diagram,
  scene: SceneDiff | null,
  component: Component,
  parentId: string,
): boolean {
  void state;
  const parent = scene?.addedComponents[parentId] ?? d.snapshot.components[parentId];
  if (!isApiGroupComponent(parent)) return false;

  const siblingCount = countEndpointsUnderParent(d, scene, parentId);
  write(scene, d, component, {
    elementId: component.id,
    x: 0,
    y: HEADER_H + siblingCount * ENDPOINT_H,
    width: FRAME_W,
    height: ENDPOINT_H,
  });
  const childCount = siblingCount + 1;
  const { width, height } = computeApiGroupSize(childCount);
  const groupLayout = scene?.nodeLayouts[parentId] ?? d.nodeLayouts[parentId];
  if (groupLayout) {
    groupLayout.width = width;
    groupLayout.height = height;
  }
  d.updatedAt = new Date().toISOString();
  return true;
}

function countEndpointsUnderParent(
  d: { snapshot: { components: Record<string, Component> } },
  scene: { addedComponents: Record<string, Component> } | null,
  parentId: string,
): number {
  let n = Object.values(d.snapshot.components).filter(
    (c) => c.parentId === parentId && isEndpointType(c.type),
  ).length;
  if (scene) {
    n += Object.values(scene.addedComponents).filter(
      (c) => c.parentId === parentId && isEndpointType(c.type),
    ).length;
  }
  return n;
}

function write(
  scene: SceneDiff | null,
  d: Diagram,
  comp: Component,
  layout: NodeLayout,
): void {
  if (scene) {
    scene.addedComponents[comp.id] = comp;
    scene.nodeLayouts[comp.id] = layout;
  } else {
    d.snapshot.components[comp.id] = comp;
    d.nodeLayouts[comp.id] = layout;
  }
}

function buildComponentForType(
  id: string,
  type: ComponentType,
  name: string,
  parentId: string | null,
  panelKind: PanelKind | undefined,
  awsService: string | undefined,
): { component: Component; resolvedPanelKind: PanelKind | undefined } {
  const base = { id, name, description: "", parentId };
  let component: Component;
  const resolvedPanelKind: PanelKind | undefined = isPanelType(type)
    ? (panelKind ?? PanelKind.Default)
    : undefined;
  if (isPanelType(type)) {
    const kind = resolvedPanelKind!;
    const def = getPanelKindDef(kind);
    const isSwimlane = kind === PanelKind.Swimlane;
    component = {
      ...base,
      type: "panel",
      panelKind: kind,
      panelColor: def.defaultColor,
      ...(isSwimlane
        ? {
            swimlane: {
              orientation: "horizontal",
              laneColor: "#6366f1",
              laneLabel: i18n.t("swimlane.defaultLaneLabel"),
            },
          }
        : {}),
    } as PanelComponent;
  } else if (isNoteType(type)) {
    component = { ...base, type: "note", panelColor: "hsl(45 25% 97%)" };
  } else if (isEndpointType(type)) {
    component = {
      ...base,
      type: "endpoint",
      method: "GET",
      path: "/novo-endpoint",
      handlers: [],
    } as EndpointComponent;
  } else if (isApiGroupType(type)) {
    component = {
      ...base,
      type: "api-group",
      serviceName: name,
      basePath: "/api/v1",
      protocol: "REST",
    } as ApiGroupComponent;
  } else if (isC4Type(type)) {
    component = { ...base, type };
  } else {
    component = { ...base, type, awsService: awsService ?? undefined };
  }
  return { component, resolvedPanelKind };
}

function resolveInsertPosition(params: {
  parentId: string | null;
  position: { x: number; y: number } | undefined;
  parentLayout: { x: number; y: number; width?: number; height?: number } | undefined;
  parentComp: Component | undefined;
}): { x: number; y: number } {
  const { parentId, position, parentLayout, parentComp } = params;
  const isChildOfPanel = !!(parentId && parentComp && isPanelComponent(parentComp));
  const centeredInParentPanel = {
    x: (parentLayout?.width ?? PANEL_DEFAULT_W) / 2 - DEFAULT_NODE_W / 2,
    y: (parentLayout?.height ?? PANEL_DEFAULT_H) / 2 - DEFAULT_NODE_H / 2,
  };
  if (isChildOfPanel) return centeredInParentPanel;
  if (!position) return { x: 300, y: 300 };
  if (parentId && parentLayout) {
    return {
      x: position.x - parentLayout.x,
      y: position.y - parentLayout.y,
    };
  }
  if (parentId && !parentLayout) {
    return { x: 40, y: 40 };
  }
  return position;
}

function buildLayoutForComponent(
  componentId: string,
  type: ComponentType,
  resolvedPanelKind: PanelKind | undefined,
  resolvedPosition: { x: number; y: number },
): NodeLayout {
  const { x, y } = resolvedPosition;
  if (isApiGroupType(type)) {
    const { width, height } = computeApiGroupSize(0);
    return { elementId: componentId, x, y, zIndex: -1, width, height };
  }
  if (isEndpointType(type)) {
    return { elementId: componentId, x, y, width: 260 };
  }
  if (isPanelType(type)) {
    return {
      elementId: componentId,
      x,
      y,
      zIndex: -1,
      width: resolvedPanelKind === PanelKind.Swimlane ? SWIMLANE_DEFAULT_W : PANEL_DEFAULT_W,
      height: resolvedPanelKind === PanelKind.Swimlane ? SWIMLANE_DEFAULT_H : PANEL_DEFAULT_H,
    };
  }
  if (isNoteType(type)) {
    return { elementId: componentId, x, y, width: NOTE_DEFAULT_W, height: NOTE_DEFAULT_H };
  }
  return { elementId: componentId, x, y };
}

export const componentsSlice = (
  set: (fn: (state: AppState) => void) => void,
  get: () => AppState,
) => ({
    addComponent: (
      type: ComponentType,
      name: string,
      parentId: string | null,
      position?: { x: number; y: number },
      awsService?: string,
      panelKind?: PanelKind,
    ): Component => {
      const id = generateId("el");
      const { component, resolvedPanelKind } = buildComponentForType(
        id,
        type,
        name,
        parentId,
        panelKind,
        awsService,
      );

      set((state) => {
        const d = state.diagrams[state.activeDiagramId]!;
        const scene = resolveActiveScene(d);

        if (!scene) pushHistory(state);

        const resolveComp = (pid: string | null | undefined) =>
          pid ? scene?.addedComponents[pid] ?? d.snapshot.components[pid] : undefined;

        const parentComp = parentId ? resolveComp(parentId) : undefined;
        const parentLayout = parentId
          ? scene?.nodeLayouts[parentId] ?? d.nodeLayouts[parentId]
          : undefined;

        if (
          isEndpointType(type) &&
          parentId &&
          handleEndpointInsertion(state, d, scene, component, parentId)
        ) {
          return;
        }

        const resolvedPosition = resolveInsertPosition({
          parentId,
          position,
          parentLayout,
          parentComp,
        });
        const layout = buildLayoutForComponent(
          component.id,
          type,
          resolvedPanelKind,
          resolvedPosition,
        );
        write(scene, d, component, layout);

        d.updatedAt = new Date().toISOString();

        const p = parentId ? resolveComp(parentId) : undefined;
        if (parentId && p && isApiGroupComponent(p)) {
          const childCount = countEndpointsUnderParent(d, scene, parentId);
          const { width, height } = computeApiGroupSize(childCount);
          const groupLayout = scene?.nodeLayouts[parentId] ?? d.nodeLayouts[parentId];
          if (groupLayout) {
            groupLayout.width = width;
            groupLayout.height = height;
          }
        }
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
      const shouldDetachTemplate = Object.keys(compPatch).some(
        (key) => key !== "templateId",
      );
      set((state) => {
        const d = state.diagrams[state.activeDiagramId]!;
        const scene = resolveActiveScene(d);
        const inSceneAdds = !!(scene && scene.addedComponents[id]);

        if (!isDimensionOnly) {
          if (!scene || !inSceneAdds) pushHistory(state);
        }

        if (inSceneAdds) {
          if (Object.keys(compPatch).length > 0) {
            Object.assign(scene!.addedComponents[id], compPatch);
            if (shouldDetachTemplate && scene!.addedComponents[id].templateId) {
              delete scene!.addedComponents[id].templateId;
            }
          }
          if (hasDimensions) {
            const layout = scene!.nodeLayouts[id];
            if (layout) {
              if (width !== undefined) layout.width = width;
              if (height !== undefined) layout.height = height;
            }
          }
        } else {
          if (Object.keys(compPatch).length > 0) {
            Object.assign(d.snapshot.components[id], compPatch);
            if (shouldDetachTemplate && d.snapshot.components[id].templateId) {
              delete d.snapshot.components[id].templateId;
            }
          }
          if (hasDimensions) {
            const layout = d.nodeLayouts[id];
            if (layout) {
              if (width !== undefined) layout.width = width;
              if (height !== undefined) layout.height = height;
            }
          }
        }
        d.updatedAt = new Date().toISOString();
      });
    },

    removeComponent: (id: string) => {
      set((state) => {
        const d = state.diagrams[state.activeDiagramId]!;
        const scene = resolveActiveScene(d);
        if (scene) {
          mutateRemoveComponentInScene(d, scene.id, id);
          d.updatedAt = new Date().toISOString();
          return;
        }

        pushHistory(state);
        const toRemove = new Set<string>();
        const collect = (eid: string) => {
          toRemove.add(eid);
          Object.values(d.snapshot.components)
            .filter((c) => c.parentId === eid)
            .forEach((c) => collect(c.id));
        };
        collect(id);

        const apiGroupParentsToSync = new Set<string>();
        toRemove.forEach((eid) => {
          const comp = d.snapshot.components[eid];
          if (comp?.parentId && isApiGroupComponent(d.snapshot.components[comp.parentId])) {
            apiGroupParentsToSync.add(comp.parentId);
          }
        });

        toRemove.forEach((eid) => delete d.snapshot.components[eid]);
        Object.values(d.snapshot.connections).forEach((conn) => {
          if (toRemove.has(conn.sourceId) || toRemove.has(conn.targetId))
            delete d.snapshot.connections[conn.id];
        });
        toRemove.forEach((eid) => delete d.nodeLayouts[eid]);

        function syncApiGroupSize(groupId: string) {
          const childCount = Object.values(d.snapshot.components).filter(
            (c) => c.parentId === groupId && isEndpointType(c.type),
          ).length;
          const { width, height } = computeApiGroupSize(childCount);
          const layout = d.nodeLayouts[groupId];
          if (layout) {
            layout.width = width;
            layout.height = height;
          }
        }

        function reindexEndpoints(groupId: string) {
          if (toRemove.has(groupId)) return;
          const siblings = Object.values(d.snapshot.components)
            .filter((c) => c.parentId === groupId && isEndpointType(c.type))
            .sort((a, b) => {
              const ay = d.nodeLayouts[a.id]?.y ?? 0;
              const by = d.nodeLayouts[b.id]?.y ?? 0;
              return ay - by;
            });
          siblings.forEach((sibling, i) => {
            const layout = d.nodeLayouts[sibling.id];
            if (layout) layout.y = HEADER_H + i * ENDPOINT_H;
          });
          syncApiGroupSize(groupId);
        }

        apiGroupParentsToSync.forEach(reindexEndpoints);

        d.updatedAt = new Date().toISOString();
      });
    },

    updateHandleOrder: (
      componentId: string,
      side: "incoming" | "outgoing",
      orderedConnectionIds: string[],
    ) => {
      set((state) => {
        const d = state.diagrams[state.activeDiagramId]!;
        const scene = resolveActiveScene(d);
        const comp =
          scene?.addedComponents[componentId] ?? d.snapshot.components[componentId];
        if (!comp) return;
        if (!comp.handleOrder) comp.handleOrder = { incoming: [], outgoing: [] };
        comp.handleOrder[side] = orderedConnectionIds;
        d.updatedAt = new Date().toISOString();
      });
    },

    setParent: (childId: string, parentId: string | null) => {
      set((state) => {
        const d = state.diagrams[state.activeDiagramId]!;
        const scene = resolveActiveScene(d);
        if (scene && !scene.addedComponents[childId]) return;
        if (!scene) pushHistory(state);
        const comp = scene?.addedComponents[childId] ?? d.snapshot.components[childId];
        if (comp) comp.parentId = parentId;
      });
    },

    groupNodes: (componentIds: string[]): string | null => {
      let panelId: string | null = null;
      set((state) => {
        const d = state.diagrams[state.activeDiagramId]!;
        if (d.activeSceneId && d.scenes?.[d.activeSceneId]) return;
        const comps = d.snapshot.components;
        const ids = componentIds.filter(
          (id) => comps[id] && !isPanelComponent(comps[id]) && !isApiGroupComponent(comps[id]),
        );
        if (ids.length < 2) return;

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

        pushHistory(state);
        const panel: PanelComponent = {
          id: generateId("el"),
          name: "Grupo",
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
        const d = state.diagrams[state.activeDiagramId!];
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
        pushHistory(state);
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


