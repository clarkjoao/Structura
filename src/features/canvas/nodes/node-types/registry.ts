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
import { c4Descriptor } from "./c4.descriptor";
import type { NodeTypeDescriptor } from "./types";
import type { Component, ComponentType } from "@/features/diagram";
import { isPanelComponent, PanelKind } from "@/features/diagram";


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
  c4Descriptor,
];


export function getDescriptor(type: ComponentType): NodeTypeDescriptor {
  return NODE_TYPE_REGISTRY.find((d) => d.matches(type)) ?? c4Descriptor;
}


export function resolveNodeDescriptor(comp: Component): NodeTypeDescriptor {
  if (isPanelComponent(comp) && comp.panelKind === PanelKind.Swimlane) {
    return swimlaneDescriptor;
  }
  return getDescriptor(comp.type);
}


export function registerDescriptor(descriptor: NodeTypeDescriptor): void {
  if (NODE_TYPE_REGISTRY.some((d) => d.rfType === descriptor.rfType)) {
    throw new Error(
      `[node-types] A descriptor with rfType "${descriptor.rfType}" is already registered.`,
    );
  }
  
  NODE_TYPE_REGISTRY.splice(NODE_TYPE_REGISTRY.length - 1, 0, descriptor);
}


export const nodeTypes: NodeTypes = Object.fromEntries(
  NODE_TYPE_REGISTRY
    .filter((d, i, arr) => arr.findIndex((x) => x.rfType === d.rfType) === i)
    .map((d) => [d.rfType, d.component]),
) as NodeTypes;