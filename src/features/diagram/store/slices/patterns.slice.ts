import type { PatternComponent, PatternTemplate } from "@/lib/catalogs/patterns";
import type { Connection } from "../../model/connection.types";
import type { Component, UserTemplate, UserTemplateComponent } from "../../model/diagram.types";
import { generateId } from "../../utils/generate-id";
import { computeUserTemplateNodeLayouts } from "../../utils/user-template-insert-layout";
import type { AppState } from "../store.types";
import { STRUCTURAL_MUTATION_MARKER } from "../store.constants";
import { pushHistory } from "./history.slice";
import { getActiveDiagram, touchDiagram } from "../helpers/get-active-diagram";

type InsertablePattern = PatternTemplate | UserTemplate;

function getConnectionEndpoints(
  conn: PatternTemplate["connections"][number] | UserTemplate["connections"][number],
): { from: number; to: number } {
  if ("fromIndex" in conn) {
    return { from: conn.fromIndex, to: conn.toIndex };
  }
  return { from: conn.sourceIndex, to: conn.targetIndex };
}

function buildConnectionRecord(
  conn: InsertablePattern["connections"][number],
  connId: string,
  sourceId: string,
  targetId: string,
): Connection {
  if ("fromIndex" in conn) {
    return {
      id: connId,
      sourceId,
      targetId,
      label: conn.label,
    };
  }
  const { sourceIndex, targetIndex, ...rest } = conn;
  return {
    ...(rest as Omit<Connection, "id" | "sourceId" | "targetId">),
    id: connId,
    sourceId,
    targetId,
  };
}

function isUserTemplatePayload(template: InsertablePattern): template is UserTemplate {
  return "createdAt" in template && typeof template.createdAt === "number";
}

function buildUserTemplateComponentPayload(
  raw: UserTemplate["components"][number],
  newId: string,
  allNewIds: string[],
): Component {
  const row = raw as UserTemplateComponent & { x?: number; y?: number };
  const {
    _relX: _rx,
    _relY: _ry,
    parentIndex,
    width: _w,
    height: _h,
    x: _legacyX,
    y: _legacyY,
    ...rest
  } = row;
  const resolvedParentId =
    parentIndex !== undefined &&
    Number.isInteger(parentIndex) &&
    parentIndex >= 0 &&
    parentIndex < allNewIds.length
      ? allNewIds[parentIndex]
      : null;
  return {
    ...rest,
    id: newId,
    parentId: resolvedParentId,
    description:
      "description" in rest && typeof rest.description === "string" ? rest.description : "",
  } as Component;
}

function buildCatalogPatternComponentAndLayout(
  raw: PatternComponent,
  newId: string,
  index: number,
  position: { x: number; y: number },
  gridX: number,
): { component: Component; layout: { elementId: string; x: number; y: number } } {
  const component = {
    id: newId,
    name: raw.name,
    type: raw.type,
    description: raw.description ?? "",
    parentId: null,
    technology: raw.technology,
    awsService: raw.awsService,
  } as Component;

  const x = raw.x !== undefined ? position.x + raw.x : position.x + index * gridX;
  const y = raw.y !== undefined ? position.y + raw.y : position.y;

  return {
    component,
    layout: { elementId: newId, x, y },
  };
}

export const patternsSlice = (
  set: (fn: (state: AppState) => void) => void,
  _get: () => AppState,
) => ({
  insertPattern: (template: InsertablePattern, position: { x: number; y: number }): string[] => {
    const GRID_X = 220;
    const userComponents = isUserTemplatePayload(template) ? template.components : null;
    const ids: string[] = template.components.map(() => generateId("el"));
    const userLayouts = userComponents
      ? computeUserTemplateNodeLayouts(userComponents, position)
      : null;

    let committed = false;
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      committed = true;
      const sid = d.activeSceneId ?? null;
      const scene = sid && d.scenes?.[sid] ? d.scenes[sid] : null;
      if (!scene) pushHistory(state, STRUCTURAL_MUTATION_MARKER);
      template.components.forEach((raw, i) => {
        let component: Component;
        let layout: { elementId: string; x: number; y: number; width?: number; height?: number };

        if (userComponents && userLayouts) {
          component = buildUserTemplateComponentPayload(userComponents[i], ids[i], ids);
          const dims = userLayouts[i];
          layout = {
            elementId: ids[i],
            x: dims.x,
            y: dims.y,
            ...(dims.width !== undefined ? { width: dims.width } : {}),
            ...(dims.height !== undefined ? { height: dims.height } : {}),
          };
        } else {
          const built = buildCatalogPatternComponentAndLayout(
            raw as PatternComponent,
            ids[i],
            i,
            position,
            GRID_X,
          );
          component = built.component;
          layout = built.layout;
        }

        if (scene) {
          scene.addedComponents[component.id] = component;
          scene.nodeLayouts[component.id] = layout;
        } else {
          d.snapshot.components[component.id] = component;
          d.nodeLayouts[component.id] = layout;
        }
      });
      template.connections.forEach((rawConn) => {
        const { from, to } = getConnectionEndpoints(rawConn);
        const connId = generateId("conn");
        const next = buildConnectionRecord(rawConn, connId, ids[from], ids[to]);
        if (scene) {
          scene.addedConnections[connId] = next;
        } else {
          d.snapshot.connections[connId] = next;
        }
      });
      touchDiagram(d);
    });
    return committed ? ids : [];
  },
});
