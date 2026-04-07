import type {
  Component,
  ComponentPatch,
  ComponentType,
  ApiGroupComponent,
  EndpointComponent,
  DbTableComponent,
  JsonViewerComponent,
  UnknownComponent,
  SvgComponent,
  PanelComponent,
  NodeLayout,
  Diagram,
  SceneDiff,
} from "../../model/diagram.types";
import { PanelKind } from "../../enums";
import { generateId } from "../../utils/generate-id";
import { isPanelComponent, isApiGroupComponent } from "../../model/component.guards";
import {
  isPanelType,
  isNoteType,
  isEndpointType,
  isApiGroupType,
  isC4Type,
  isDbTableType,
  isJsonViewerType,
  isUnknownType,
  isSvgComponentType,
} from "../../model/component-type-constants";
import { getPanelKindDef } from "@/lib/catalogs/panels";
import { isAwsType } from "@/lib/catalogs/aws";
import type { AppState } from "../store.types";
import { STRUCTURAL_MUTATION_MARKER } from "../store.constants";
import { pushHistory } from "./history.slice";
import { getActiveDiagram } from "./get-active-diagram";
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
  API_GROUP_HEADER_H,
  API_GROUP_ENDPOINT_H,
  API_GROUP_FRAME_W,
} from "../../model/layout.constants";
import i18n from "@/infrastructure/i18n";
import { computeApiGroupSize } from "../../utils/api-group-size";
import { buildChildrenIndex, getDescendantIdsFromIndex } from "../../utils/children-index";
import { mutateRemoveComponentInScene } from "../../utils/scene-mutations";

/**
 * Este slice usa Immer via Zustand middleware.
 * Mutacoes diretas dentro de `set((state) => { ... })` sao seguras
 * e produzem novo estado imutavel automaticamente.
 * Nao usar spread/Object.assign para substituir objetos inteiros -
 * prefira mutacoes diretas: `state.field = value`.
 */
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
    y: API_GROUP_HEADER_H + siblingCount * API_GROUP_ENDPOINT_H,
    width: API_GROUP_FRAME_W,
    height: API_GROUP_ENDPOINT_H,
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
        path: i18n.t("canvas.defaultEndpointPath"),
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
  } else if (isDbTableType(type)) {
    const tableName = name.trim().length > 0 ? name : i18n.t("dbTable.unnamedTable");
    component = {
      ...base,
      name: tableName,
      type: "db-table",
      tableName,
      columns: [],
    } as DbTableComponent;
  } else if (isJsonViewerType(type)) {
    component = {
      ...base,
      type: "json-viewer",
      jsonContent: "{}",
    } as JsonViewerComponent;
  } else if (isC4Type(type)) {
    component = { ...base, type };
  } else if (isAwsType(type)) {
    component = { ...base, type, awsService: awsService ?? undefined };
  } else if (isUnknownType(type)) {
    component = { ...base, type: "unknown", rawContent: "" } as UnknownComponent;
  } else if (isSvgComponentType(type)) {
    component = {
      ...base,
      type: "svg",
      svgContent: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"></svg>',
    } as SvgComponent;
  } else {
    component = { ...base, type: "unknown", rawContent: "" } as UnknownComponent;
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
  if (isDbTableType(type)) {
    const dbTableFixedH = 32 + 22 + 20 + 2;
    return {
      elementId: componentId,
      x,
      y,
      width: 406,
      height: dbTableFixedH,
    };
  }
  if (isJsonViewerType(type)) {
    return { elementId: componentId, x, y, width: 240, height: 88 };
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
        const d = getActiveDiagram(state);
        if (!d) return;
        const scene = resolveActiveScene(d);

        if (!scene) pushHistory(state, STRUCTURAL_MUTATION_MARKER);

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
        const d = getActiveDiagram(state);
        if (!d) return;
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
        const d = getActiveDiagram(state);
        if (!d) return;
        const scene = resolveActiveScene(d);
        if (scene) {
          mutateRemoveComponentInScene(d, scene.id, id);
          d.updatedAt = new Date().toISOString();
          return;
        }

        pushHistory(state, STRUCTURAL_MUTATION_MARKER);
        const childrenIndex = buildChildrenIndex(d.snapshot.components);
        const toRemove = getDescendantIdsFromIndex(id, childrenIndex);
        toRemove.add(id);

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
            if (layout) layout.y = API_GROUP_HEADER_H + i * API_GROUP_ENDPOINT_H;
          });
          syncApiGroupSize(groupId);
        }

        apiGroupParentsToSync.forEach(reindexEndpoints);

        d.updatedAt = new Date().toISOString();
      });
    },

  });
