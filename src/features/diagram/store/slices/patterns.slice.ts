import type { Connection } from "../../model/connection.types";
import type {
  Component,
  NodeLayout,
  UserTemplate,
  UserTemplateComponent,
} from "../../model/diagram.types";
import type { PatternFragment } from "../../model/pattern-fragment.types";
import { isC4Component } from "../../model/component.guards";
import { canBeConnectionSource } from "../../model/connection-rules";
import { UNSIZED_NODE_EXTENT_H, UNSIZED_NODE_EXTENT_W } from "../../model/layout.constants";
import { generateId } from "../../utils/generate-id";
import { freeInsertOrigin, type Box } from "../../utils/free-insert-origin";
import { computeUserTemplateNodeLayouts } from "../../utils/user-template-insert-layout";
import type { AppState } from "../store.types";
import { STRUCTURAL_MUTATION_MARKER } from "../store.constants";
import { pushHistory } from "./history.slice";
import { getActiveDiagram, touchDiagram } from "../helpers/get-active-diagram";
import { resolveActiveVersion, writeComponentAndLayout } from "../helpers/version-helpers";
import { buildComponentForType, buildLayoutForComponent } from "./components.slice";
import { buildConnection, writeConnection } from "./connections.slice";

function buildUserTemplateConnection(
  conn: UserTemplate["connections"][number],
  connId: string,
  sourceId: string,
  targetId: string,
): Connection {
  const { sourceIndex, targetIndex, ...rest } = conn;
  return {
    ...(rest as Omit<Connection, "id" | "sourceId" | "targetId">),
    id: connId,
    sourceId,
    targetId,
  };
}

function isPatternFragment(template: UserTemplate | PatternFragment): template is PatternFragment {
  return "patternId" in template;
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

/** Top-level nodes of the active scene, as the boxes a new fragment must not cover. */
function occupiedBoxes(state: AppState): Box[] {
  const d = getActiveDiagram(state);
  if (!d) return [];
  const scene = resolveActiveVersion(d);
  const components = { ...d.snapshot.components, ...(scene?.addedComponents ?? {}) };
  const layouts = { ...d.nodeLayouts, ...(scene?.nodeLayouts ?? {}) };
  return Object.values(components).flatMap((component) => {
    if (component.parentId) return [];
    const layout = layouts[component.id];
    if (!layout) return [];
    return [
      {
        x: layout.x,
        y: layout.y,
        width: layout.width ?? UNSIZED_NODE_EXTENT_W,
        height: layout.height ?? UNSIZED_NODE_EXTENT_H,
      },
    ];
  });
}

/**
 * Writes a resolved catalog pattern. Every node is built the way `addComponent`
 * builds one — the descriptor creates it and sizes it — so a pattern node is
 * the same as one inserted from the catalog. A boundary keeps the size the
 * resolver gave it, to fit its children.
 */
function insertFragment(
  state: AppState,
  fragment: PatternFragment,
  position: { x: number; y: number },
  ids: string[],
): void {
  const d = getActiveDiagram(state);
  if (!d) return;
  const scene = resolveActiveVersion(d);
  const origin = freeInsertOrigin(position, fragment, occupiedBoxes(state));

  fragment.nodes.forEach((node, i) => {
    const parentId = node.parentIndex === null ? null : ids[node.parentIndex];
    const { component, resolvedPanelKind } = buildComponentForType(
      ids[i],
      node.type,
      node.name,
      parentId,
      node.createOptions.panelKind,
      node.createOptions.serviceId,
      node.createOptions.flowShape,
      node.createOptions,
    );
    if (node.technology !== undefined && isC4Component(component)) {
      component.technology = node.technology;
    }
    const at = parentId ? { x: node.x, y: node.y } : { x: origin.x + node.x, y: origin.y + node.y };
    const layout: NodeLayout = {
      ...buildLayoutForComponent(
        ids[i],
        node.type,
        resolvedPanelKind,
        at,
        node.createOptions.flowShape,
        node.createOptions,
      ),
      ...(node.width !== undefined ? { width: node.width } : {}),
      ...(node.height !== undefined ? { height: node.height } : {}),
    };
    writeComponentAndLayout(d, scene, component, layout);
  });

  for (const edge of fragment.edges) {
    // An edge out of a note or a table can never be drawn; the catalog test keeps
    // them out, and this keeps a bad entry from writing one.
    if (!canBeConnectionSource(fragment.nodes[edge.from].type)) continue;
    writeConnection(d, scene, buildConnection(ids[edge.from], ids[edge.to], edge.label));
  }
}

export const patternsSlice = (
  set: (fn: (state: AppState) => void) => void,
  _get: () => AppState,
) => ({
  /**
   * Inserts a resolved catalog pattern or a saved template, as one undo step.
   * A pattern is moved right, as a whole, when it would cover existing nodes.
   */
  insertPattern: (
    template: UserTemplate | PatternFragment,
    position: { x: number; y: number },
  ): string[] => {
    if (isPatternFragment(template)) {
      const ids = template.nodes.map(() => generateId("el"));
      let committed = false;
      set((state) => {
        const d = getActiveDiagram(state);
        if (!d) return;
        committed = true;
        if (!resolveActiveVersion(d)) pushHistory(state, STRUCTURAL_MUTATION_MARKER);
        insertFragment(state, template, position, ids);
        touchDiagram(d);
      });
      return committed ? ids : [];
    }

    const userComponents = template.components;
    const ids: string[] = template.components.map(() => generateId("el"));
    const userLayouts = computeUserTemplateNodeLayouts(userComponents, position);

    let committed = false;
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      committed = true;
      const sid = d.activeVersionId ?? null;
      const scene = sid && d.versions?.[sid] ? d.versions[sid] : null;
      if (!scene) pushHistory(state, STRUCTURAL_MUTATION_MARKER);
      userComponents.forEach((raw, i) => {
        const component = buildUserTemplateComponentPayload(raw, ids[i], ids);
        const dims = userLayouts[i];
        const layout = {
          elementId: ids[i],
          x: dims.x,
          y: dims.y,
          ...(dims.width !== undefined ? { width: dims.width } : {}),
          ...(dims.height !== undefined ? { height: dims.height } : {}),
        };

        if (scene) {
          scene.addedComponents[component.id] = component;
          scene.nodeLayouts[component.id] = layout;
        } else {
          d.snapshot.components[component.id] = component;
          d.nodeLayouts[component.id] = layout;
        }
      });
      template.connections.forEach((rawConn) => {
        const connId = generateId("conn");
        const next = buildUserTemplateConnection(
          rawConn,
          connId,
          ids[rawConn.sourceIndex],
          ids[rawConn.targetIndex],
        );
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
