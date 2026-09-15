import type { NodeTypes } from "@xyflow/react";
import { c4Descriptor } from "./c4.descriptor";
import type { NodeTypeDescriptor } from "./types";
import type { NodeHandleSpec } from "./handle-spec";
import type { Component, ComponentType } from "@/features/diagram";
import { COMPONENT_TYPE_UNKNOWN, isPluginComponentType } from "@/features/diagram";
import {
  allElements,
  elementDefaultSize,
  getElement,
  resolveElementCanvas,
  subscribeElements,
} from "@/features/elements/element.registry";
import type { ElementCanvasSlice, ElementDescriptor } from "@/features/elements/element.types";

/**
 * What the canvas still resolves the old way.
 *
 * Down to the catch-all: every built-in type except the four C4 ones now lives
 * on the element registry, and plugin descriptors are spliced in ahead of the
 * catch-all at runtime. C4 and the cloud families follow in F4.
 */
export const NODE_TYPE_REGISTRY: NodeTypeDescriptor[] = [c4Descriptor];

/**
 * A registered element's canvas slice, seen as a `NodeTypeDescriptor`.
 *
 * Adapting rather than re-declaring keeps every existing reader — the node
 * builder, the handle-slot assignment, the `nodeTypes` map — working while
 * types move across one slice at a time. Cached by id so the adapted object
 * keeps a stable identity across renders, which the `nodeTypes` map and the
 * node memoisation both depend on.
 */
const adaptedDescriptors = new WeakMap<ElementCanvasSlice, NodeTypeDescriptor>();

function adaptElement(element: ElementDescriptor, canvas = element.canvas): NodeTypeDescriptor {
  const cached = adaptedDescriptors.get(canvas);
  if (cached) return cached;

  const adapted: NodeTypeDescriptor = {
    rfType: canvas.rfType,
    component: canvas.component,
    matches: (type) => type === element.id,
    zIndex: canvas.zIndex,
    connectable: canvas.connectable,
    handles: canvas.handles,
    canHaveParent: canvas.canHaveParent,
    canBeParent: canvas.canBeParent,
    buildData: canvas.buildData,
    buildStyle: canvas.buildStyle,
    // NodeTypeDescriptor still wants both dimensions; an element that leaves
    // its height to the content has none to give, and the legacy field has no
    // reader that would use it anyway.
    defaultSize: (() => {
      const size = elementDefaultSize(element);
      return size.height === undefined ? undefined : { width: size.width, height: size.height };
    })(),
    draggable: canvas.draggable,
    selectable: canvas.selectable,
    focusable: canvas.focusable,
    dragHandle: canvas.dragHandle,
  };

  adaptedDescriptors.set(canvas, adapted);
  return adapted;
}

export function getDescriptor(type: ComponentType): NodeTypeDescriptor {
  // Registered elements answer first: during the migration a type is owned by
  // the registry or by the legacy chain below, never by both.
  const element = getElement(type);
  if (element) return adaptElement(element);

  if (isPluginComponentType(type)) {
    // The C4 catch-all must not absorb plugin types: orphaned ones (plugin disabled or
    // uninstalled) degrade to `unknown`, so the data is visibly foreign, never corrupted.
    const contributed = NODE_TYPE_REGISTRY.find((d) => d !== c4Descriptor && d.matches(type));
    if (contributed) return contributed;
    // `unknown` is a registered element now, so the fallback comes from there.
    const fallback = getElement(COMPONENT_TYPE_UNKNOWN);
    return fallback ? adaptElement(fallback) : c4Descriptor;
  }
  return NODE_TYPE_REGISTRY.find((d) => d.matches(type)) ?? c4Descriptor;
}

/**
 * The handle set a component type declares.
 *
 * The one reader that matters is `buildEdgeHandleAssignments`, which picks the
 * slot an edge attaches to: asking the registry is what keeps the slot inside
 * what the node will render, for plugin types as much as for the built-in ones.
 */
export function handleSpecForType(type: ComponentType): NodeHandleSpec {
  return getDescriptor(type).handles;
}

export function resolveNodeDescriptor(comp: Component): NodeTypeDescriptor {
  // A registered element may render more than one way for the same type — a
  // panel that is a lane. The element says which; this used to be a hardcoded
  // swimlane branch right here.
  const element = getElement(comp.type);
  if (element) {
    const canvas = resolveElementCanvas(comp) ?? element.canvas;
    return adaptElement(element, canvas);
  }
  return getDescriptor(comp.type);
}

const listeners = new Set<() => void>();

function buildNodeTypes(): NodeTypes {
  const registered = allElements().flatMap((element) => [
    adaptElement(element),
    // A variant renders under its own React Flow type, so the map needs it too.
    ...(element.variants ?? []).map((variant) => adaptElement(element, variant.canvas)),
  ]);
  const descriptors = [...registered, ...NODE_TYPE_REGISTRY];
  return Object.fromEntries(
    descriptors
      .filter((d, i, arr) => arr.findIndex((x) => x.rfType === d.rfType) === i)
      .map((d) => [d.rfType, d.component]),
  ) as NodeTypes;
}

let nodeTypesSnapshot: NodeTypes = buildNodeTypes();

// Elements may register after this module is evaluated (bootstrap order is not
// guaranteed), so the map is rebuilt when one appears.
subscribeElements(() => notifyRegistryChanged());

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
