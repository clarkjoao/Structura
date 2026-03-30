import type { Component, Diagram } from "../model/diagram.types";
import { isEndpointType } from "../model/component-type-constants";
import { isApiGroupComponent } from "../model/component.guards";
import { computeApiGroupSize } from "./api-group-size";
import { baseConnectionsTouchingAny, collectBaseDescendantIds } from "./scene.utils";

/** Mutate diagram draft: remove/hide component within a scene (same rules as removeComponentFromScene). */
export function mutateRemoveComponentInScene(d: Diagram, sceneId: string, componentId: string): void {
  const sc = d.scenes?.[sceneId];
  if (!sc) return;

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

    toRemove.forEach((eid) => {
      delete sc.addedComponents[eid];
      delete sc.nodeLayouts[eid];
    });
    Object.keys(sc.addedConnections).forEach((cid) => {
      const c = sc.addedConnections[cid];
      if (toRemove.has(c.sourceId) || toRemove.has(c.targetId)) {
        delete sc.addedConnections[cid];
      }
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

    return;
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
}

/** Mutate diagram draft: remove connection within a scene. */
export function mutateRemoveConnectionInScene(d: Diagram, sceneId: string, connectionId: string): void {
  const sc = d.scenes?.[sceneId];
  if (!sc) return;

  if (sc.addedConnections[connectionId]) {
    delete sc.addedConnections[connectionId];
    return;
  }

  if (d.snapshot.connections[connectionId] && !sc.removedConnectionIds.includes(connectionId)) {
    sc.removedConnectionIds.push(connectionId);
  }
}
