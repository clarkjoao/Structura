import type { Node } from "@xyflow/react";
import type { Component, ComponentPatch, ComponentType } from "@/features/diagram";
import type { CustomComponentTemplate } from "../customComponent.types";

const ALLOWED_COMPONENT_PATCH_KEYS = new Set<string>([
  "name",
  "description",
  "parentId",
  "customIconId",
  "tags",
  "serviceId",
  "linkedDiagramId",
  "hidden",
  "handleOrder",
  "technology",
  "panelColor",
  "panelKind",
  "panelOpacity",
  "borderStyle",
  "collapsed",
  "collapsedWidth",
  "collapsedHeight",
  "swimlane",
  "awsService",
  "serviceName",
  "basePath",
  "protocol",
  "sla",
  "method",
  "path",
  "endpointDescription",
  "handlers",
  "templateId",
  "registryServiceId",
]);

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  return {};
}

function resolveBaseType(node: Node, nodeData: Record<string, unknown>): ComponentType {
  if (typeof node.type === "string" && node.type.length > 0) {
    return node.type as ComponentType;
  }
  if (typeof nodeData.type === "string" && nodeData.type.length > 0) {
    return nodeData.type as ComponentType;
  }
  return "component";
}

/** React Flow node.data fields that are UI-only and must not be persisted on templates. */
const NODE_DATA_UI_ONLY_KEYS = new Set<string>([
  "isSelected",
  "controlsDisabled",
  "incomingCount",
  "outgoingCount",
  "isRecording",
  "isLastRecorded",
  "recordingBadges",
  "onDrillDown",
  "onEmbed",
  "onReorderHandle",
  "onHandleClick",
  "coverageFlowNames",
  "activeHandleId",
  "lastRecordedHandleId",
  "compareBadges",
  "sceneBadge",
  "elementId",
]);

function removeUndefinedEntries(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
}

function templateRecordFromDomainComponent(component: Component): Record<string, unknown> {
  const skipKeys = new Set<string>(["id", "templateId"]);
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(component)) {
    if (skipKeys.has(key)) {
      continue;
    }
    if (value === undefined) {
      continue;
    }
    if (key === "type" || ALLOWED_COMPONENT_PATCH_KEYS.has(key)) {
      next[key] = value;
    }
  }
  next.type = component.type;
  return removeUndefinedEntries(next);
}

function templateRecordFromStrippedNodeData(
  nodeData: Record<string, unknown>,
  baseType: ComponentType,
): Record<string, unknown> {
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(nodeData)) {
    if (NODE_DATA_UI_ONLY_KEYS.has(key)) {
      continue;
    }
    if (value === undefined) {
      continue;
    }
    if (key === "type" || ALLOWED_COMPONENT_PATCH_KEYS.has(key)) {
      next[key] = value;
    }
  }
  next.type = baseType;
  return removeUndefinedEntries(next);
}

export function createTemplateDataFromNode(
  node: Node,
  domainComponent?: Component,
): {
  baseType: ComponentType;
  data: Record<string, unknown>;
  registryServiceId?: string;
} {
  const nodeData = asRecord(node.data);
  const baseType = domainComponent?.type ?? resolveBaseType(node, nodeData);
  const serviceId =
    domainComponent?.serviceId ??
    (typeof nodeData.serviceId === "string" ? nodeData.serviceId : undefined);

  const data = domainComponent
    ? templateRecordFromDomainComponent(domainComponent)
    : templateRecordFromStrippedNodeData(nodeData, baseType);

  return {
    baseType,
    data,
    registryServiceId: serviceId,
  };
}

export function buildComponentPatchFromTemplate(
  template: CustomComponentTemplate,
  hasRegistryService: boolean,
): ComponentPatch {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(template.data)) {
    if (!ALLOWED_COMPONENT_PATCH_KEYS.has(key) || key === "registryServiceId") continue;
    patch[key] = value;
  }
  patch.templateId = template.id;
  if (template.registryServiceId && hasRegistryService) {
    patch.serviceId = template.registryServiceId;
  } else {
    delete patch.registryServiceId;
    patch.serviceId = undefined;
  }
  return patch as ComponentPatch;
}
