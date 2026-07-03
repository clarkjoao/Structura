import type { NodeTypes } from "@xyflow/react";
import { panelDescriptor } from "./panel.descriptor";
import { swimlaneDescriptor } from "./swimlane.descriptor";
import { noteDescriptor } from "./note.descriptor";
import { apiGroupDescriptor } from "./apigroup.descriptor";
import { endpointDescriptor } from "./endpoint.descriptor";
import { svgDescriptor } from "./svg.descriptor";
import { unknownDescriptor } from "./unknown.descriptor";
import { dbTableDescriptor } from "./dbtable.descriptor";
import { jsonViewerDescriptor } from "./jsonviewer.descriptor";
import { flowNodeDescriptor } from "./flownode.descriptor";
import { externalElementDescriptor } from "./external-element.descriptor";
import { c4Descriptor } from "./c4.descriptor";
import type { NodeTypeDescriptor } from "./types";
import type { Component, ComponentType } from "@/features/diagram";
import { isPanelComponent, isPluginComponentType, PanelKind } from "@/features/diagram";

export const NODE_TYPE_REGISTRY: NodeTypeDescriptor[] = [
  panelDescriptor,
  swimlaneDescriptor,
  noteDescriptor,
  apiGroupDescriptor,
  endpointDescriptor,
  dbTableDescriptor,
  jsonViewerDescriptor,
  svgDescriptor,
  unknownDescriptor,
  flowNodeDescriptor,
  externalElementDescriptor,
  c4Descriptor,
];

export function getDescriptor(type: ComponentType): NodeTypeDescriptor {
  if (isPluginComponentType(type)) {
    // The C4 catch-all must not absorb plugin types: orphaned ones (plugin disabled or
    // uninstalled) degrade to `unknown`, so the data is visibly foreign, never corrupted.
    return (
      NODE_TYPE_REGISTRY.find((d) => d !== c4Descriptor && d.matches(type)) ?? unknownDescriptor
    );
  }
  return NODE_TYPE_REGISTRY.find((d) => d.matches(type)) ?? c4Descriptor;
}

export function resolveNodeDescriptor(comp: Component): NodeTypeDescriptor {
  if (isPanelComponent(comp) && comp.panelKind === PanelKind.Swimlane) {
    return swimlaneDescriptor;
  }
  return getDescriptor(comp.type);
}

const listeners = new Set<() => void>();

function buildNodeTypes(): NodeTypes {
  return Object.fromEntries(
    NODE_TYPE_REGISTRY.filter((d, i, arr) => arr.findIndex((x) => x.rfType === d.rfType) === i).map(
      (d) => [d.rfType, d.component],
    ),
  ) as NodeTypes;
}

let nodeTypesSnapshot: NodeTypes = buildNodeTypes();

function notifyRegistryChanged(): void {
  nodeTypesSnapshot = buildNodeTypes();
  for (const listener of listeners) listener();
}

export function registerDescriptor(descriptor: NodeTypeDescriptor): void {
  if (NODE_TYPE_REGISTRY.some((d) => d.rfType === descriptor.rfType)) {
    throw new Error(
      `[node-types] A descriptor with rfType "${descriptor.rfType}" is already registered.`,
    );
  }

  // Keep the catch-all (c4Descriptor) last so it always matches after everything else.
  NODE_TYPE_REGISTRY.splice(NODE_TYPE_REGISTRY.length - 1, 0, descriptor);
  notifyRegistryChanged();
}

export function unregisterDescriptor(rfType: string): void {
  const index = NODE_TYPE_REGISTRY.findIndex((d) => d.rfType === rfType);
  if (index === -1) return;
  NODE_TYPE_REGISTRY.splice(index, 1);
  notifyRegistryChanged();
}

/** Subscribe to registry changes; returns unsubscribe. */
export function subscribeNodeTypes(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Current React Flow nodeTypes map; a new object identity after every registry change. */
export function getNodeTypesSnapshot(): NodeTypes {
  return nodeTypesSnapshot;
}

/**
 * @deprecated Snapshot taken at module load; late (plugin) registrations never reach it.
 * Use `useNodeTypes()` in React or `getNodeTypesSnapshot()` elsewhere.
 */
export const nodeTypes: NodeTypes = nodeTypesSnapshot;
