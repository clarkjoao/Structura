import type { Node } from "@xyflow/react";
import type { Component, ComponentPatch, ComponentType } from "@/features/diagram";
import { sanitizeComponentType } from "@/features/diagram";
import type { CustomComponentTemplate } from "../types";

const ALLOWED_COMPONENT_PATCH_KEYS = new Set<string>([
  "name",
  "description",
  "parentId",
  "customIconId",
  "tags",
  "serviceId",
  "linkedDiagramId",
  "referenceDiagramId",
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
  "tableName",
  "columns",
  "jsonContent",
  "schemaRef",
  "templateId",
  "serviceId",
]);

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  return {};
}

function resolveBaseType(node: Node, nodeData: Record<string, unknown>): ComponentType {
  if (typeof node.type === "string" && node.type.length > 0) {
    return sanitizeComponentType(node.type);
  }
  if (typeof nodeData.type === "string" && nodeData.type.length > 0) {
    return sanitizeComponentType(nodeData.type);
  }
  return "component";
}

const NODE_DATA_UI_ONLY_KEYS = new Set<string>([
  "isSelected",
  "controlsDisabled",
  "incomingCount",
  "outgoingCount",
  "isRecording",
  "isLastRecorded",
  "stepBadges",
  "onDrillDown",
  "onEmbed",
  "onReorderHandle",
  "onCommit",
  "onHandleClick",
  "coverageFlowNames",
  "activeHandleId",
  "lastRecordedHandleId",
  "compareBadges",
  "sceneBadge",
  "elementId",
  "onStartEdit",
  "onInlineEditingChange",
  "layoutWidth",
  "layoutHeight",
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
  // Sanitize the type so a corrupted component.type (e.g. "API Endpoints
  // /api/v1 · REST" from a previous template-replication cycle) doesn't
  // get persisted as the template's baseType.
  next.type = sanitizeComponentType(component.type);
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
  serviceId?: string;
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
    serviceId,
  };
}

export function buildComponentPatchFromTemplate(
  template: CustomComponentTemplate,
  hasRegistryService: boolean,
): ComponentPatch {
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(template.data)) {
    if (!ALLOWED_COMPONENT_PATCH_KEYS.has(key)) continue;
    patch[key] = value;
  }
  patch.templateId = template.id;
  if (template.serviceId && hasRegistryService) {
    patch.serviceId = template.serviceId;
  } else {
    patch.serviceId = undefined;
  }
  return patch as ComponentPatch;
}
