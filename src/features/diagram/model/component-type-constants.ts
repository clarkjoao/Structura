import { PanelKind } from "../enums";
import type { ComponentType } from "./component.types";
import { isAwsType } from "@/lib/catalogs/aws";
import i18n from "@/infrastructure/i18n";

export const C4_TYPES = ["person", "system", "container", "component"] as const;
export type C4Type = (typeof C4_TYPES)[number];

export const COMPONENT_TYPE_PANEL = "panel";
export const COMPONENT_TYPE_NOTE = "note";
export const COMPONENT_TYPE_API_GROUP = "api-group";
export const COMPONENT_TYPE_ENDPOINT = "endpoint";
export const COMPONENT_TYPE_DB_TABLE = "db-table";
export const COMPONENT_TYPE_JSON_VIEWER = "json-viewer";

export const COMPONENT_TYPE_UNKNOWN = "unknown";

export const COMPONENT_TYPE_SVG = "svg";

export const COMPONENT_TYPE_EXTERNAL_ELEMENT = "external-element";

/** @deprecated Use COMPONENT_TYPE_PROCESS_NODE */
export const COMPONENT_TYPE_FLOW_NODE = "process-node";

/** @deprecated Use COMPONENT_TYPE_PROCESS_NODE */
export const COMPONENT_TYPE_PROCESSOS = "process-node";

export const COMPONENT_TYPE_PROCESS_NODE = "process-node";

/** Legacy type strings; both are migrated to "process-node" by
 * `migrateProcessNodeTypeToProcessNode` in `store/persist.config.ts`. */
const LEGACY_FLOW_NODE_TYPE = "flow-node";
const LEGACY_PROCESSOS_TYPE = "processos";

/** Matches the canonical `process-node` and both legacy strings during the
 * migration window. Prefer `isProcessNodeType` in new code. */
export function isFlowNodeType(type: string): type is "process-node" {
  return (
    type === COMPONENT_TYPE_PROCESS_NODE ||
    type === LEGACY_FLOW_NODE_TYPE ||
    type === LEGACY_PROCESSOS_TYPE
  );
}

export function isProcessNodeType(type: string): type is "process-node" {
  return isFlowNodeType(type);
}

export function isSvgComponentType(type: string): type is "svg" {
  return type === COMPONENT_TYPE_SVG;
}

export function isReactFlowParentPanelType(nodeType: string): boolean {
  return nodeType === COMPONENT_TYPE_PANEL || nodeType === PanelKind.Swimlane;
}

export function isPanelType(type: string): type is "panel" {
  return type === COMPONENT_TYPE_PANEL;
}

export function isNoteType(type: string): type is "note" {
  return type === COMPONENT_TYPE_NOTE;
}

export function isC4Type(type: string): type is C4Type {
  return C4_TYPES.includes(type as C4Type);
}

export function isPersonType(type: string): type is "person" {
  return type === "person";
}

export function isSystemType(type: string): type is "system" {
  return type === "system";
}

export function isContainerType(type: string): type is "container" {
  return type === "container";
}

export function isComponentType(type: string): type is "component" {
  return type === "component";
}

export function isEndpointType(type: string): type is "endpoint" {
  return type === COMPONENT_TYPE_ENDPOINT;
}

export function isApiGroupType(type: string): type is "api-group" {
  return type === COMPONENT_TYPE_API_GROUP;
}

export function isUnknownType(type: string): type is "unknown" {
  return type === COMPONENT_TYPE_UNKNOWN;
}

/** Plugin component types are namespaced "<pluginId>/<name>"; no built-in type contains "/". */
export function isPluginComponentType(type: string): type is `${string}/${string}` {
  return type.includes("/");
}

export function isDbTableType(type: string): type is "db-table" {
  return type === COMPONENT_TYPE_DB_TABLE;
}

export function isJsonViewerType(type: string): type is "json-viewer" {
  return type === COMPONENT_TYPE_JSON_VIEWER;
}

export function isExternalElementType(type: string): type is "external-element" {
  return type === COMPONENT_TYPE_EXTERNAL_ELEMENT;
}

export function isPanelKind(value: string): value is PanelKind {
  return Object.values(PanelKind).includes(value as PanelKind);
}

export function getUsageKeyForType(type: ComponentType, panelKind?: PanelKind): string {
  if (isPanelType(type) || isNoteType(type)) {
    return `canvas:${type}${panelKind ? `:${panelKind}` : ""}`;
  }
  if (
    isEndpointType(type) ||
    isApiGroupType(type) ||
    isDbTableType(type) ||
    isJsonViewerType(type) ||
    isFlowNodeType(type)
  ) {
    return `canvas:${type}`;
  }
  if (isC4Type(type)) {
    return `c4:${type}`;
  }
  if (isAwsType(type)) {
    return `aws:${type}`;
  }
  return `canvas:${type}`;
}

export function getDefaultNameForNewComponent(
  type: ComponentType,
  label: string,
  panelDefaultName?: string,
): string {
  if (isNoteType(type)) return "";
  if (isEndpointType(type)) return i18n.t("canvas.newEndpoint");
  if (isApiGroupType(type)) return i18n.t("canvas.apiGroupDefaultName");
  if (isDbTableType(type))
    return i18n.t("quickInsert.newNamed", {
      name: i18n.t("nodeTypes.db-table"),
    });
  if (isJsonViewerType(type))
    return i18n.t("quickInsert.newNamed", {
      name: i18n.t("nodeTypes.json-viewer"),
    });
  if (isFlowNodeType(type)) return label;
  if (isPanelType(type) && panelDefaultName) return panelDefaultName;
  return i18n.t("quickInsert.newNamed", { name: label });
}
