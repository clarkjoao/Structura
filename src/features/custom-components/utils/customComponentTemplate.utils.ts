import type { Node } from "@xyflow/react";
import type { ComponentPatch, ComponentType } from "@/features/diagram";
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

export function createTemplateDataFromNode(node: Node): {
  baseType: ComponentType;
  data: Record<string, unknown>;
  registryServiceId?: string;
} {
  const nodeData = asRecord(node.data);
  const baseType = resolveBaseType(node, nodeData);
  const serviceId = typeof nodeData.serviceId === "string" ? nodeData.serviceId : undefined;
  return {
    baseType,
    data: {
      ...nodeData,
      type: baseType,
    },
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
