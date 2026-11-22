import { isKindProps } from "@/features/diagram/model/diagram-kind";
import type {
  Component,
  Connection,
  Diagram,
  NodeLayout,
  VersionDiff,
} from "../../model/diagram.types";
import type { KindEdit, KindEditResult } from "../../model/kind-edit.types";
import { isEmptyKindEdit } from "../../model/kind-edit.types";
import { isPanelComponent, isProcessNodeComponent } from "../../model/component.guards";
import { PanelKind } from "../../enums";
import { canBeConnectionSource } from "../../model/connection-rules";
import { sanitizeComponentType } from "../../model/sanitize-component-type";
import { canContain } from "@/features/elements/containment";
import { generateId } from "../../utils/generate-id";
import type { AppState } from "../store.types";
import { STRUCTURAL_MUTATION_MARKER } from "../store.constants";
import { pushHistory } from "./history.slice";
import { touchDiagram } from "../helpers/get-active-diagram";
import {
  resolveActiveVersion,
  resolveComponent,
  writableComponent,
  writableConnection,
  writableNodeLayout,
  writeComponentAndLayout,
} from "../helpers/version-helpers";
import { buildComponentForType, removeElementsInDraft } from "./components.slice";

const EMPTY: KindEditResult = { idsByKey: {}, connectionIds: [] };

function connectionsOf(d: Diagram, scene: VersionDiff | null): Record<string, Connection> {
  return scene ? { ...d.snapshot.connections, ...scene.addedConnections } : d.snapshot.connections;
}

/**
 * Applies a kind edit to a draft whose history the caller has already handled.
 *
 * The same writes as plugin `applyChanges` (`applyGraphChanges`): Version-aware
 * through the copy-on-write helpers, unknown ids skipped, a typed container
 * refusing what it does not take. On top: re-parenting, re-wiring and
 * relabelling connections, flows (base only — flows are not versioned) and the
 * kind's data.
 */
function applyKindEditInDraft(state: AppState, d: Diagram, edit: KindEdit): KindEditResult {
  const scene = resolveActiveVersion(d);
  const idsByKey: Record<string, string> = {};
  for (const node of edit.add ?? []) idsByKey[node.key] = generateId("el");
  const resolveId = (ref: string): string | null => {
    const fromKey = idsByKey[ref];
    if (fromKey) return fromKey;
    return resolveComponent(d, scene, ref) ? ref : null;
  };

  for (const update of edit.update ?? []) {
    const component = writableComponent(d, scene, update.id)?.component;
    if (!component) continue;
    if (update.name !== undefined) {
      component.name = update.name;
      // A swimlane's header shows its own label first: keep the two together.
      if (isPanelComponent(component) && component.swimlane) {
        component.swimlane.laneLabel = update.name;
      }
    }
    if (update.description !== undefined) component.description = update.description;
    if (update.flowShape !== undefined && isProcessNodeComponent(component)) {
      component.flowShape = update.flowShape;
    }
    if (update.kindProps === null) delete component.kindProps;
    else if (update.kindProps !== undefined && isKindProps(update.kindProps))
      component.kindProps = update.kindProps;
  }

  // Nodes first, in order, so a node may name an earlier one of the batch as its parent.
  for (const node of edit.add ?? []) {
    const id = idsByKey[node.key]!;
    const type = sanitizeComponentType(node.type);
    const parentId = node.parent === null ? null : resolveId(node.parent);
    const parent = parentId
      ? (resolveComponent(d, scene, parentId) as Component | undefined)
      : null;
    const accepted = parent && canContain(parent.type, type) ? parent.id : null;
    const { component } = buildComponentForType(
      id,
      type,
      node.name,
      accepted,
      node.panelKind,
      undefined,
      node.flowShape,
    );
    if (node.description !== undefined) component.description = node.description;
    if (node.kindProps !== undefined && isKindProps(node.kindProps))
      component.kindProps = node.kindProps;
    if (isPanelComponent(component) && component.panelKind === PanelKind.Swimlane) {
      component.swimlane = {
        ...component.swimlane,
        laneLabel: node.name,
        ...(node.lane?.orientation && { orientation: node.lane.orientation }),
        ...(node.lane?.color && { laneColor: node.lane.color }),
      };
    }
    const layout: NodeLayout = {
      elementId: id,
      x: node.x,
      y: node.y,
      ...(node.width !== undefined ? { width: node.width } : {}),
      ...(node.height !== undefined ? { height: node.height } : {}),
    };
    writeComponentAndLayout(d, scene, component, layout);
  }

  for (const move of edit.reparent ?? []) {
    const component = writableComponent(d, scene, move.id)?.component;
    if (!component) continue;
    const parentId = move.parent === null ? null : resolveId(move.parent);
    const parent = parentId ? resolveComponent(d, scene, parentId) : undefined;
    if (move.parent !== null && (!parent || !canContain(parent.type, component.type))) continue;
    component.parentId = parent ? parent.id : null;
    const layout = writableNodeLayout(d, scene, move.id);
    if (layout && Number.isFinite(move.x) && Number.isFinite(move.y)) {
      layout.x = move.x;
      layout.y = move.y;
    }
  }

  // After re-parenting: removing a lane must not take the steps just moved out of it.
  const exists = (id: string) => resolveComponent(d, scene, id) !== undefined;
  const remove = (edit.remove ?? []).filter(exists);
  const connections = connectionsOf(d, scene);
  const disconnect = (edit.disconnect ?? []).filter((id) => connections[id] !== undefined);
  if (remove.length > 0 || disconnect.length > 0) {
    removeElementsInDraft(state, d, remove, disconnect, scene);
  }

  let moved = false;
  for (const move of edit.move ?? []) {
    if (!Number.isFinite(move.x) || !Number.isFinite(move.y)) continue;
    const layout = writableNodeLayout(d, scene, move.id);
    if (!layout) continue;
    layout.x = move.x;
    layout.y = move.y;
    if (move.width !== undefined) layout.width = move.width;
    if (move.height !== undefined) layout.height = move.height;
    moved = true;
  }
  if (moved || (edit.reparent?.length ?? 0) > 0) {
    // The canvas keeps a local copy of node positions (see `applyAutoLayout`).
    state._lastLayoutWriteAt = (state._lastLayoutWriteAt ?? 0) + 1;
  }

  for (const wire of edit.reconnect ?? []) {
    const connection = writableConnection(d, scene, wire.id)?.connection;
    if (!connection) continue;
    const sourceId = wire.source === undefined ? connection.sourceId : resolveId(wire.source);
    const targetId = wire.target === undefined ? connection.targetId : resolveId(wire.target);
    if (!sourceId || !targetId) continue;
    connection.sourceId = sourceId;
    connection.targetId = targetId;
  }

  for (const { id, orientation } of edit.laneOrientation ?? []) {
    const component = writableComponent(d, scene, id)?.component;
    if (component && isPanelComponent(component) && component.panelKind === PanelKind.Swimlane) {
      component.swimlane = { ...component.swimlane, orientation };
    }
  }

  for (const relabel of edit.relabel ?? []) {
    const connection = writableConnection(d, scene, relabel.id)?.connection;
    if (connection) connection.label = relabel.label;
  }

  const connectionIds = (edit.connect ?? []).map((edge) => {
    const sourceId = resolveId(edge.source);
    const targetId = resolveId(edge.target);
    if (!sourceId || !targetId) return null;
    const source = resolveComponent(d, scene, sourceId);
    if (!source || !canBeConnectionSource(source.type)) return null;
    const connection: Connection = {
      id: generateId("conn"),
      sourceId,
      targetId,
      label: edge.label ?? "",
    };
    if (scene) scene.addedConnections[connection.id] = connection;
    else d.snapshot.connections[connection.id] = connection;
    return connection.id;
  });

  for (const id of edit.flows?.remove ?? []) delete d.snapshot.flows[id];
  for (const flow of edit.flows?.set ?? []) d.snapshot.flows[flow.id] = flow;

  if (edit.kindData !== undefined) d.kindData = edit.kindData;

  touchDiagram(d);
  return { idsByKey, connectionIds };
}

export const kindSlice = (set: (fn: (state: AppState) => void) => void, _get: () => AppState) => ({
  /**
   * Applies a kind edit to a diagram (the active one when omitted). With
   * `history: false` it amends the last checkpoint instead of opening one — the
   * kind's own derivation and arrangement after an edit, which one undo of that
   * edit reverts with it.
   */
  applyKindEdit: (
    edit: KindEdit,
    options: { diagramId?: string; history?: boolean } = {},
  ): KindEditResult => {
    if (isEmptyKindEdit(edit)) return EMPTY;
    let result: KindEditResult = EMPTY;
    set((state) => {
      const id = options.diagramId ?? state.activeDiagramId;
      const d = id ? state.diagrams[id] : undefined;
      if (!d) return;
      if (options.history !== false) pushHistory(state, STRUCTURAL_MUTATION_MARKER, d);
      result = applyKindEditInDraft(state, d, edit);
    });
    return result;
  },

  /**
   * Switches a kind diagram between its kind's editor and freehand, applying
   * `edit` (the kind's arrangement and derivation on a return) in the same
   * checkpoint. A freehand diagram (no kind) is left alone.
   */
  setKindMode: (diagramId: string, mode: "kind" | "freehand", edit?: KindEdit): KindEditResult => {
    let result: KindEditResult = EMPTY;
    set((state) => {
      const d = state.diagrams[diagramId];
      if (!d || d.kind === undefined) return;
      pushHistory(state, STRUCTURAL_MUTATION_MARKER, d);
      if (mode === "freehand") d.kindMode = "freehand";
      else delete d.kindMode;
      if (edit) result = applyKindEditInDraft(state, d, edit);
      touchDiagram(d);
    });
    return result;
  },
});
