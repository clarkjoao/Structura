import type { Diagram } from "../model/diagram.types";
import { isEndpointType } from "../model/component-type-constants";
import { isApiGroupComponent } from "../model/component.guards";
import { computeApiGroupSize } from "./api-group-size";
import {
  repairFlowsAfterRemovingDiagramElements,
  toFlowSewNotices,
  type FlowSewNotice,
} from "./flow-repair";
import { baseConnectionsTouchingAny, collectBaseDescendantIds } from "./scene.utils";

/**
 * Sews the base flows after a scene dropped elements it had added itself.
 *
 * A step can name a component that only ever existed inside a scene. Deleting
 * that component leaves the step pointing at nothing, and the path that
 * normally closes the script up never runs, because nothing left the base
 * snapshot. So the same repair runs here, over the same reports, and returns
 * the same notice — a script is never sewn without saying so.
 *
 * Elements the scene merely *hides* are not passed here: they are still in the
 * model, and the steps that name them still mean what they said.
 */
function sewFlowsAfterSceneRemoval(
  d: Diagram,
  componentIds: ReadonlySet<string>,
  connectionIds: ReadonlySet<string>,
  names: ReadonlyMap<string, string>,
): FlowSewNotice[] {
  if (componentIds.size === 0 && connectionIds.size === 0) return [];
  const reports = repairFlowsAfterRemovingDiagramElements(
    d.snapshot.flows,
    componentIds,
    connectionIds,
  );
  return toFlowSewNotices(reports, names);
}

/**
 * Removes a component from a scene, and reports what that did to the scripts.
 *
 * Two different removals share this name. A component the scene *added* is
 * deleted outright — it exists nowhere else — so the flows are sewn and the
 * joins come back to be said out loud. A component from the base is only
 * hidden: nothing leaves the model, no flow changes, and the list is empty.
 */
export function mutateRemoveComponentInScene(
  d: Diagram,
  sceneId: string,
  componentId: string,
): FlowSewNotice[] {
  const sc = d.scenes?.[sceneId];
  if (!sc) return [];

  if (sc.addedComponents[componentId]) {
    const toRemove = new Set<string>();
    const collect = (eid: string) => {
      toRemove.add(eid);
      Object.values(sc.addedComponents)
        .filter((c) => c.parentId === eid)
        .forEach((c) => collect(c.id));
    };
    collect(componentId);

    const apiGroupParents = new Set<string>();
    toRemove.forEach((eid) => {
      const comp = sc.addedComponents[eid];
      if (!comp?.parentId) return;
      const parent = d.snapshot.components[comp.parentId] ?? sc.addedComponents[comp.parentId];
      if (parent && isApiGroupComponent(parent)) {
        apiGroupParents.add(comp.parentId);
      }
    });

    // Read before the deletes: a notice names what left, and by the time the
    // flows are sewn it is no longer there to be named.
    const names = new Map<string, string>();
    const droppedConnectionIds = new Set<string>();
    toRemove.forEach((eid) => {
      const name = sc.addedComponents[eid]?.name;
      if (name) names.set(eid, name);
    });
    Object.keys(sc.addedConnections).forEach((cid) => {
      const c = sc.addedConnections[cid];
      if (toRemove.has(c.sourceId) || toRemove.has(c.targetId)) {
        droppedConnectionIds.add(cid);
        if (c.label) names.set(cid, c.label);
      }
    });

    toRemove.forEach((eid) => {
      delete sc.addedComponents[eid];
      delete sc.nodeLayouts[eid];
    });
    droppedConnectionIds.forEach((cid) => {
      delete sc.addedConnections[cid];
    });

    apiGroupParents.forEach((groupId) => {
      const childCount =
        Object.values(d.snapshot.components).filter(
          (c) => c.parentId === groupId && isEndpointType(c.type),
        ).length +
        Object.values(sc.addedComponents).filter(
          (c) => c.parentId === groupId && isEndpointType(c.type),
        ).length;
      const { width, height } = computeApiGroupSize(childCount);
      const layout = sc.nodeLayouts[groupId] ?? d.nodeLayouts[groupId];
      if (layout) {
        layout.width = width;
        layout.height = height;
      }
    });

    return sewFlowsAfterSceneRemoval(d, toRemove, droppedConnectionIds, names);
  }

  if (d.snapshot.components[componentId]) {
    const ids = collectBaseDescendantIds(d.snapshot.components, componentId);
    const idSet = new Set(ids);
    for (const id of ids) {
      if (!sc.removedComponentIds.includes(id)) {
        sc.removedComponentIds.push(id);
      }
    }
    const connIds = baseConnectionsTouchingAny(d.snapshot.connections, idSet);
    for (const cid of connIds) {
      if (!sc.removedConnectionIds.includes(cid)) {
        sc.removedConnectionIds.push(cid);
      }
    }
  }

  return [];
}

/**
 * Removes a connection from a scene, and reports what that did to the scripts.
 *
 * Same split as components: one the scene added is deleted for good and the
 * flows are sewn; one from the base is only hidden and nothing changes.
 */
export function mutateRemoveConnectionInScene(
  d: Diagram,
  sceneId: string,
  connectionId: string,
): FlowSewNotice[] {
  const sc = d.scenes?.[sceneId];
  if (!sc) return [];

  const added = sc.addedConnections[connectionId];
  if (added) {
    const names = new Map<string, string>();
    if (added.label) names.set(connectionId, added.label);
    delete sc.addedConnections[connectionId];
    return sewFlowsAfterSceneRemoval(d, new Set(), new Set([connectionId]), names);
  }

  if (d.snapshot.connections[connectionId] && !sc.removedConnectionIds.includes(connectionId)) {
    sc.removedConnectionIds.push(connectionId);
  }

  return [];
}
