import { refsOf, resolveShared, sharedMode } from "../../utils/shared";
import { resolveVersionSnapshot } from "../../utils/version.utils";
import type {
  Component,
  ComponentPatch,
  ComponentType,
  PanelComponent,
  NodeLayout,
  Diagram,
  VersionDiff,
} from "../../model/diagram.types";
import { PanelKind } from "../../enums";
import { generateId } from "../../utils/generate-id";
import {
  isPanelComponent,
  isApiGroupComponent,
  isSharedRefComponent,
} from "../../model/component.guards";
import {
  isPanelType,
  isEndpointType,
  isPluginComponentType,
  COMPONENT_TYPE_UNKNOWN,
  COMPONENT_TYPE_SHARED_REF,
} from "../../model/component-type-constants";
import type { FlowNodeShape, SharedRefComponent } from "../../model/component.types";
import type { AutoRefAssignment } from "../actions.types";
import { getPanelKindDef } from "@/lib/catalogs/panels";
import {
  elementDefaultSize,
  getElement,
  isRegisteredElementType,
} from "@/features/elements/element.registry";
import type { ElementCreateOptions } from "@/features/elements/element.types";
import { canContain } from "@/features/elements/containment";
import { canBeReferenced } from "@/features/elements/referencing";
import type { AppState } from "../store.types";
import { STRUCTURAL_MUTATION_MARKER } from "../store.constants";
import { pushHistory } from "./history.slice";
import { getActiveDiagram, touchDiagram } from "../helpers/get-active-diagram";
import { publishSewNotices } from "../helpers/publish-sew-notices";
import {
  resolveActiveVersion,
  resolveComponent,
  resolveNodeLayout,
  writeComponentAndLayout,
} from "../helpers/version-helpers";
import {
  PANEL_DEFAULT_W,
  PANEL_DEFAULT_H,
  SWIMLANE_DEFAULT_W,
  SWIMLANE_DEFAULT_H,
  DEFAULT_NODE_W,
  DEFAULT_NODE_H,
  API_GROUP_HEADER_H,
  API_GROUP_ENDPOINT_H,
  API_GROUP_FRAME_W,
} from "../../model/layout.constants";
import i18n from "@/infrastructure/i18n";
import { computeApiGroupSize } from "../../utils/api-group-size";
import { buildChildrenIndex, getDescendantIdsFromIndex } from "../../utils/children-index";
import {
  mutateRemoveComponentInVersion,
  mutateRemoveConnectionInVersion,
} from "../../utils/version-mutations";
import {
  repairFlowsAfterRemovingDiagramElements,
  removedRoots,
  toFlowSewNotices,
  type FlowSewNotice,
} from "../../utils/flow-repair";

function handleEndpointInsertion(
  state: AppState,
  d: Diagram,
  scene: VersionDiff | null,
  component: Component,
  parentId: string,
): boolean {
  void state;
  const parent = resolveComponent(d, scene, parentId);
  if (!parent || !isApiGroupComponent(parent)) return false;

  const siblingCount = countEndpointsUnderParent(d, scene, parentId);
  writeComponentAndLayout(d, scene, component, {
    elementId: component.id,
    x: 0,
    y: API_GROUP_HEADER_H + siblingCount * API_GROUP_ENDPOINT_H,
    width: API_GROUP_FRAME_W,
    height: API_GROUP_ENDPOINT_H,
  });
  const childCount = siblingCount + 1;
  const { width, height } = computeApiGroupSize(childCount);
  const groupLayout = resolveNodeLayout(d, scene, parentId);
  if (groupLayout) {
    groupLayout.width = width;
    groupLayout.height = height;
  }
  touchDiagram(d);
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

export function buildComponentForType(
  id: string,
  type: ComponentType,
  name: string,
  parentId: string | null,
  panelKind: PanelKind | undefined,
  cloudServiceId: string | undefined,
  flowShape?: FlowNodeShape,
  createOptions: ElementCreateOptions = {},
): { component: Component; resolvedPanelKind: PanelKind | undefined } {
  const base = { id, name, description: "", parentId };

  // Registered elements build themselves from their descriptor. Narrowing here
  // (rather than testing `hasElement`) is what lets the chain below drop a
  // migrated branch and still be exhaustive: the id leaves the union.
  if (isRegisteredElementType(type)) {
    const descriptor = getElement(type)!;
    return {
      // 5th positional arg is cloudServiceId (F6b; was named awsService).
      // Descriptors read it as `ElementCreateOptions.serviceId` → attachService
      // writes `cloudServiceId` on the component.
      component: descriptor.model.createComponent(base, {
        ...createOptions,
        panelKind,
        flowShape,
        serviceId: cloudServiceId,
      }),
      // Still reported, because the caller passes it on to the layout builder
      // and a panel's size depends on which kind was asked for.
      resolvedPanelKind: isPanelType(type) ? (panelKind ?? PanelKind.Default) : undefined,
    };
  }

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
  } else if (isPluginComponentType(type)) {
    component = { ...base, type };
  } else {
    // If a new ComponentType is added and not handled here, this runtime error
    // signals that the corresponding branch needs to be added.
    const _exhaustive: never = type;
    void _exhaustive;
    // Unreachable while the union is exhaustive; `unknown` is the safe landing
    // for a type that slipped past it, and the registry owns how to build one.
    component = getElement(COMPONENT_TYPE_UNKNOWN)!.model.createComponent(base, {});
  }
  return { component, resolvedPanelKind };
}

/** The references that stand for any of `ids`, which go when those go. */
function refsRemovedWith(d: Diagram, ids: string[]): { ids: string[]; name: string } {
  const scene = resolveActiveVersion(d);
  const components = scene ? resolveVersionSnapshot(d, scene.id).components : d.snapshot.components;
  const removing = new Set(ids);
  const refIds = ids
    .flatMap((id) => refsOf(id, components))
    .filter((refId) => !removing.has(refId));
  const named = ids.find((id) => refsOf(id, components).length > 0);
  return { ids: [...new Set(refIds)], name: named ? (components[named]?.name ?? "") : "" };
}

function publishRefNotice(state: AppState, refs: { ids: string[]; name: string }): void {
  if (refs.ids.length === 0) return;
  state._sharedRefNotice = {
    id: (state._sharedRefNotice?.id ?? 0) + 1,
    name: refs.name,
    count: refs.ids.length,
  };
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
  flowShape?: FlowNodeShape,
  createOptions: ElementCreateOptions = {},
): NodeLayout {
  const { x, y } = resolvedPosition;
  // Decision 3: for a registered element the descriptor's defaultSize governs,
  // instead of a literal repeated here.
  const registered = getElement(type);
  if (registered) {
    // Everything the element was created with sizes it.
    const { width, height } = elementDefaultSize(registered, {
      ...createOptions,
      panelKind: resolvedPanelKind,
      flowShape,
    });
    return {
      elementId: componentId,
      x,
      y,
      width,
      // Both omitted deliberately when the descriptor says nothing: a height
      // the node measures itself must not be pinned here, and only a frame
      // declares a stacking order.
      ...(height === undefined ? {} : { height }),
      ...(registered.model.defaultZIndex === undefined
        ? {}
        : { zIndex: registered.model.defaultZIndex }),
    };
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
  return { elementId: componentId, x, y };
}

/**
 * Removes a set of components (with descendants) and standalone connection ids
 * from `d`'s live snapshot, without touching history. Shared by `removeComponent`
 * and the batched `removeElements` so a multi-element delete pushes one history
 * checkpoint instead of one per removed id.
 */
function removeElementsFromSnapshot(
  d: Diagram,
  nodeIds: string[],
  edgeIds: string[],
): FlowSewNotice[] {
  const childrenIndex = buildChildrenIndex(d.snapshot.components);
  const toRemove = new Set<string>();
  nodeIds.forEach((id) => {
    getDescendantIdsFromIndex(id, childrenIndex).forEach((descendantId) =>
      toRemove.add(descendantId),
    );
    toRemove.add(id);
  });

  const apiGroupParentsToSync = new Set<string>();
  toRemove.forEach((eid) => {
    const comp = d.snapshot.components[eid];
    if (comp?.parentId && isApiGroupComponent(d.snapshot.components[comp.parentId])) {
      apiGroupParentsToSync.add(comp.parentId);
    }
  });

  const removedConnectionIds = new Set<string>(edgeIds);
  for (const connection of Object.values(d.snapshot.connections)) {
    if (toRemove.has(connection.sourceId) || toRemove.has(connection.targetId)) {
      removedConnectionIds.add(connection.id);
    }
  }

  // Read before the deletes: the notice names what left the diagram, and by
  // the time the flows are sewn it is no longer there to be named.
  const elementNames = new Map<string, string>();
  toRemove.forEach((eid) => {
    const name = d.snapshot.components[eid]?.name;
    if (name) elementNames.set(eid, name);
  });
  removedConnectionIds.forEach((connectionId) => {
    const label = d.snapshot.connections[connectionId]?.label;
    if (label) elementNames.set(connectionId, label);
  });

  // Read before the deletes too: which requested element took each one along.
  const rootOf = removedRoots(
    toRemove,
    new Set(nodeIds),
    (id) => d.snapshot.components[id]?.parentId,
  );

  toRemove.forEach((eid) => delete d.snapshot.components[eid]);
  removedConnectionIds.forEach((connectionId) => {
    delete d.snapshot.connections[connectionId];
  });
  toRemove.forEach((eid) => delete d.nodeLayouts[eid]);

  const reports = repairFlowsAfterRemovingDiagramElements(
    d.snapshot.flows,
    toRemove,
    removedConnectionIds,
  );
  const notices = toFlowSewNotices(reports, elementNames, rootOf);

  const syncApiGroupSize = (groupId: string) => {
    const childCount = Object.values(d.snapshot.components).filter(
      (c) => c.parentId === groupId && isEndpointType(c.type),
    ).length;
    const { width, height } = computeApiGroupSize(childCount);
    const layout = d.nodeLayouts[groupId];
    if (layout) {
      layout.width = width;
      layout.height = height;
    }
  };

  const reindexEndpoints = (groupId: string) => {
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
  };

  apiGroupParentsToSync.forEach(reindexEndpoints);

  return notices;
}

/** Space between a node and a reference placed beside it. */
const REF_GAP = 48;

/** The components of the active scene, or the base diagram's when none is open. */
function sceneComponents(d: Diagram): Record<string, Component> {
  const scene = resolveActiveVersion(d);
  return scene ? resolveVersionSnapshot(d, scene.id).components : d.snapshot.components;
}

/**
 * Where a reference drawn to the right of `nodeId` goes, vertically centred on
 * it: the node's parent, or the nearest ancestor that takes a reference when a
 * typed container does not, with the position in that parent's coordinates.
 */
function besideNode(
  d: Diagram,
  scene: VersionDiff | null,
  components: Record<string, Component>,
  nodeId: string,
): { parentId: string | null; position: { x: number; y: number } } | null {
  const layout = resolveNodeLayout(d, scene, nodeId);
  if (!layout) return null;
  const refSize = elementDefaultSize(getElement(COMPONENT_TYPE_SHARED_REF)!);
  let x = layout.x + (layout.width ?? DEFAULT_NODE_W) + REF_GAP;
  let y = layout.y + ((layout.height ?? DEFAULT_NODE_H) - (refSize.height ?? 0)) / 2;
  let parentId = components[nodeId]?.parentId ?? null;
  while (parentId) {
    const parent = components[parentId];
    if (!parent || canContain(parent.type, COMPONENT_TYPE_SHARED_REF)) break;
    const parentLayout = resolveNodeLayout(d, scene, parentId);
    x += parentLayout?.x ?? 0;
    y += parentLayout?.y ?? 0;
    parentId = parent.parentId;
  }
  return { parentId, position: { x, y } };
}

/**
 * Writes a new reference to `originalId` inside an open `set`, and turns the
 * original to ref mode when it was still drawn with its edges: making a
 * reference is how an element becomes shared, not a mode picked beforehand.
 */
function writeSharedRef(
  d: Diagram,
  scene: VersionDiff | null,
  original: Component,
  parentId: string | null,
  position: { x: number; y: number },
  id: string = generateId("el"),
): Component {
  const { component } = buildComponentForType(
    id,
    COMPONENT_TYPE_SHARED_REF,
    original.name,
    parentId,
    undefined,
    undefined,
    undefined,
    { refOf: original.id },
  );
  const layout = buildLayoutForComponent(
    component.id,
    COMPONENT_TYPE_SHARED_REF,
    undefined,
    position,
  );
  writeComponentAndLayout(d, scene, component, layout);
  const stored = resolveComponent(d, scene, original.id);
  if (stored && sharedMode(stored) === "edges") stored.shared = { mode: "ref" };
  return component;
}

/**
 * Makes the base diagram's automatic references exactly `assignments`, inside
 * an open `set` that has already pushed history. Every automatic reference is
 * first dissolved back into its original (the auto-layout planned without
 * them); the assigned ones are then kept, or made, and the edges from their
 * consumers moved onto them. What is left over goes. A reference the user made
 * is never touched. An original the auto-layout turned to ref mode goes back to
 * drawing its edges once it has no reference left.
 */
export function reconcileAutoRefs(d: Diagram, assignments: readonly AutoRefAssignment[]): void {
  const components = d.snapshot.components;
  const connections = Object.values(d.snapshot.connections);
  const autoRefs = new Map<string, SharedRefComponent>();
  for (const component of Object.values(components)) {
    if (isSharedRefComponent(component) && component.auto) autoRefs.set(component.id, component);
  }
  const dissolved = new Set([...autoRefs.values()].map((ref) => ref.refOf));
  if (autoRefs.size === 0 && assignments.length === 0) return;

  const clearPath = (connectionId: string) => {
    const edgeLayout = d.edgeLayouts[connectionId];
    if (edgeLayout?.points) delete edgeLayout.points;
  };
  for (const connection of connections) {
    const target = autoRefs.get(connection.targetId);
    if (target) {
      connection.targetId = target.refOf;
      clearPath(connection.id);
    }
    const source = autoRefs.get(connection.sourceId);
    if (source) {
      connection.sourceId = source.refOf;
      clearPath(connection.id);
    }
  }

  const kept = new Set<string>();
  for (const assignment of assignments) {
    const original = components[assignment.originalId];
    if (!original || !canBeReferenced(original)) continue;
    const existing = autoRefs.get(assignment.refId);
    if (existing) {
      existing.parentId = assignment.parentId;
    } else {
      const created = writeSharedRef(
        d,
        null,
        original,
        assignment.parentId,
        { x: 0, y: 0 },
        assignment.refId,
      );
      const stored = components[created.id];
      if (stored && isSharedRefComponent(stored)) stored.auto = true;
    }
    kept.add(assignment.refId);
    const consumers = new Set(assignment.sourceIds);
    for (const connection of connections) {
      if (connection.targetId !== assignment.originalId) continue;
      const source = components[connection.sourceId];
      const layoutSourceId =
        source?.parentId && isApiGroupComponent(components[source.parentId])
          ? source.parentId
          : connection.sourceId;
      if (!consumers.has(layoutSourceId)) continue;
      connection.targetId = assignment.refId;
      clearPath(connection.id);
    }
  }

  const stale = [...autoRefs.keys()].filter((id) => !kept.has(id));
  if (stale.length > 0) removeElementsFromSnapshot(d, stale, []);

  for (const originalId of dissolved) {
    const original = components[originalId];
    if (!original || sharedMode(original) !== "ref") continue;
    if (refsOf(originalId, components).length === 0) delete original.shared;
  }
}

/** A component of the active diagram's scene, by id — for checks made before `set`. */
function getActiveComponentById(state: AppState, id: string): Component | undefined {
  const d = state.diagrams[state.activeDiagramId ?? ""];
  if (!d) return undefined;
  const scene = resolveActiveVersion(d);
  return resolveComponent(d, scene, id);
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
    cloudServiceId?: string,
    panelKind?: PanelKind,
    flowShape?: FlowNodeShape,
    createOptions?: ElementCreateOptions,
  ): Component => {
    const id = generateId("el");
    // A typed container refuses what it does not take: the node is created at
    // the top level instead, as a paste or a generated graph would be.
    const requestedParent = parentId ? getActiveComponentById(get(), parentId) : undefined;
    if (requestedParent && !canContain(requestedParent.type, type)) parentId = null;
    const { component, resolvedPanelKind } = buildComponentForType(
      id,
      type,
      name,
      parentId,
      panelKind,
      cloudServiceId,
      flowShape,
      createOptions,
    );

    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const scene = resolveActiveVersion(d);

      if (!scene) pushHistory(state, STRUCTURAL_MUTATION_MARKER);

      const resolveComp = (pid: string | null | undefined) =>
        pid ? resolveComponent(d, scene, pid) : undefined;

      const parentComp = parentId ? resolveComp(parentId) : undefined;
      const parentLayout = parentId
        ? (scene?.nodeLayouts[parentId] ?? d.nodeLayouts[parentId])
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
        flowShape,
        createOptions,
      );
      writeComponentAndLayout(d, scene, component, layout);

      touchDiagram(d);

      const p = parentId ? resolveComp(parentId) : undefined;
      if (parentId && p && isApiGroupComponent(p)) {
        const childCount = countEndpointsUnderParent(d, scene, parentId);
        const { width, height } = computeApiGroupSize(childCount);
        const groupLayout = resolveNodeLayout(d, scene, parentId);
        if (groupLayout) {
          groupLayout.width = width;
          groupLayout.height = height;
        }
      }
    });
    return component;
  },

  /**
   * A new reference to `elementId` at `position` in `parentId`. Only an
   * original is referenced: asked for a reference of a reference, nothing is made. One undo step with the original's
   * switch to ref mode. The canvas takes the store's positions afterwards, so
   * a node dragged to make it goes back to where it was.
   */
  addSharedRef: (
    elementId: string,
    parentId: string | null,
    position: { x: number; y: number },
  ): Component | null => {
    let created: Component | null = null;
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const scene = resolveActiveVersion(d);
      const components = sceneComponents(d);
      const original = components[elementId];
      if (!original || !canBeReferenced(original)) return;
      const parent = parentId ? components[parentId] : undefined;
      const inParent = parent && canContain(parent.type, COMPONENT_TYPE_SHARED_REF);
      pushHistory(state, STRUCTURAL_MUTATION_MARKER);
      created = writeSharedRef(d, scene, original, inParent ? parentId : null, position);
      state._lastLayoutWriteAt = (state._lastLayoutWriteAt ?? 0) + 1;
      touchDiagram(d);
    });
    return created;
  },

  /**
   * Draws an edge through a reference: a new reference to its target, beside
   * its source, and the edge ending on it instead. The edge keeps its label,
   * style and meaning — it is read as reaching the original everywhere.
   */
  routeConnectionThroughRef: (connectionId: string): Component | null => {
    let created: Component | null = null;
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const scene = resolveActiveVersion(d);
      const connection =
        scene?.addedConnections[connectionId] ?? d.snapshot.connections[connectionId];
      if (!connection) return;
      const components = sceneComponents(d);
      const target = components[connection.targetId];
      if (!target || !canBeReferenced(target)) return;
      if (resolveShared(connection.sourceId, components) === target.id) return;
      const place = besideNode(d, scene, components, connection.sourceId);
      if (!place) return;
      pushHistory(state, STRUCTURAL_MUTATION_MARKER);
      created = writeSharedRef(d, scene, target, place.parentId, place.position);
      connection.targetId = created.id;
      // Its bends were drawn for the old path; the new one is short and fresh.
      const edgeLayout = d.edgeLayouts[connectionId];
      if (edgeLayout?.points) {
        delete edgeLayout.points;
        if (edgeLayout.labelOffset === undefined && edgeLayout.pathType === undefined) {
          delete d.edgeLayouts[connectionId];
        }
      }
      touchDiagram(d);
    });
    return created;
  },

  updateComponent: (id: string, patch: ComponentPatch) => {
    const patchAny = patch as Record<string, unknown>;
    const width = patchAny.width as number | undefined;
    const height = patchAny.height as number | undefined;
    const hasDimensions = width !== undefined || height !== undefined;
    const isDimensionOnly =
      hasDimensions && Object.keys(patch).every((k) => k === "width" || k === "height");

    const compPatch: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(patchAny)) {
      if (k !== "width" && k !== "height") compPatch[k] = v;
    }
    const shouldDetachTemplate = Object.keys(compPatch).some((key) => key !== "templateId");
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const scene = resolveActiveVersion(d);
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
      touchDiagram(d);
    });
  },

  removeComponent: (id: string) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const scene = resolveActiveVersion(d);
      // A shared element's references go with it: they stand for nothing else.
      const refs = refsRemovedWith(d, [id]);
      if (scene) {
        pushHistory(state, STRUCTURAL_MUTATION_MARKER);
        publishSewNotices(state, [
          ...mutateRemoveComponentInVersion(d, scene.id, id),
          ...refs.ids.flatMap((refId) => mutateRemoveComponentInVersion(d, scene.id, refId)),
        ]);
        publishRefNotice(state, refs);
        touchDiagram(d);
        return;
      }

      pushHistory(state, STRUCTURAL_MUTATION_MARKER);
      publishSewNotices(state, removeElementsFromSnapshot(d, [id, ...refs.ids], []));
      publishRefNotice(state, refs);
      touchDiagram(d);
    });
  },

  /**
   * Removes many components and/or connections as a single undoable step.
   * Used by multi-select delete and AI-suggestion rejection so a batch delete
   * doesn't push one history checkpoint per removed element (see
   * `insertGeneratedGraph`, which batches inserts for the same reason).
   */
  removeElements: (nodeIds: string[], edgeIds: string[]) => {
    if (nodeIds.length === 0 && edgeIds.length === 0) return;
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const scene = resolveActiveVersion(d);
      const refs = refsRemovedWith(d, nodeIds);
      const allNodeIds = [...nodeIds, ...refs.ids];
      if (scene) {
        pushHistory(state, STRUCTURAL_MUTATION_MARKER);
        publishSewNotices(state, [
          ...allNodeIds.flatMap((id) => mutateRemoveComponentInVersion(d, scene.id, id)),
          ...edgeIds.flatMap((id) => mutateRemoveConnectionInVersion(d, scene.id, id)),
        ]);
        publishRefNotice(state, refs);
        touchDiagram(d);
        return;
      }

      pushHistory(state, STRUCTURAL_MUTATION_MARKER);
      publishSewNotices(state, removeElementsFromSnapshot(d, allNodeIds, edgeIds));
      publishRefNotice(state, refs);
      touchDiagram(d);
    });
  },
});
