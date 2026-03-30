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
import { c4Descriptor } from "./c4.descriptor";
import type { NodeTypeDescriptor } from "./types";
import type { Component, ComponentType } from "@/features/diagram";
import { isPanelComponent, PanelKind } from "@/features/diagram";

/**
 * Ordered list of node type descriptors.
 * Descriptors are evaluated in order — c4 must be last because it is the catch-all.
 *
 * To add a new node type:
 *   1. Create a new file `<name>.descriptor.ts` implementing NodeTypeDescriptor
 *   2. Import and insert it here before c4Descriptor
 */
export const NODE_TYPE_REGISTRY: NodeTypeDescriptor[] = [
  panelDescriptor,
  swimlaneDescriptor,
  noteDescriptor,
  apiGroupDescriptor,
  endpointDescriptor,
  dbTableDescriptor,
  jsonViewerDescriptor,
  svgDescriptor,
  unknownDescriptor, // before catch-all
  c4Descriptor, // catch-all — must be last
];

/** Returns the descriptor for the given component type. Falls back to c4. */
export function getDescriptor(type: ComponentType): NodeTypeDescriptor {
  return NODE_TYPE_REGISTRY.find((d) => d.matches(type)) ?? c4Descriptor;
}

/** Resolves descriptor from full component (handles `panel` + `panelKind: "swimlane"`). */
export function resolveNodeDescriptor(comp: Component): NodeTypeDescriptor {
  if (isPanelComponent(comp) && comp.panelKind === PanelKind.Swimlane) {
    return swimlaneDescriptor;
  }
  return getDescriptor(comp.type);
}

/**
 * Register a new descriptor at runtime.
 * Inserts it before c4Descriptor (the catch-all) so it is evaluated first.
 * Throws if a descriptor with the same rfType is already registered.
 */
export function registerDescriptor(descriptor: NodeTypeDescriptor): void {
  if (NODE_TYPE_REGISTRY.some((d) => d.rfType === descriptor.rfType)) {
    throw new Error(
      `[node-types] A descriptor with rfType "${descriptor.rfType}" is already registered.`,
    );
  }
  // Insert before the last element (c4Descriptor catch-all)
  NODE_TYPE_REGISTRY.splice(NODE_TYPE_REGISTRY.length - 1, 0, descriptor);
}

/**
 * ReactFlow nodeTypes map, auto-derived from the registry.
 * Import this in Canvas.tsx instead of building the object by hand.
 */
export const nodeTypes: NodeTypes = Object.fromEntries(
  NODE_TYPE_REGISTRY
    .filter((d, i, arr) => arr.findIndex((x) => x.rfType === d.rfType) === i)
    .map((d) => [d.rfType, d.component]),
) as NodeTypes;