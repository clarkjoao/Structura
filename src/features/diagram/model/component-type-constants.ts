/**
 * Central constants and type guards for ComponentType and PanelKind.
 * Use these instead of string literals (e.g. type === "panel") across the codebase.
 */
import { PanelKind } from "../enums";
import type { ComponentType } from "./component.types";
import { isAwsType } from "@/lib/catalogs/aws";
import i18n from "@/infrastructure/i18n";

// --- C4 component types (person, system, container, component) ---
export const C4_TYPES = ["person", "system", "container", "component"] as const;
export type C4Type = (typeof C4_TYPES)[number];

// --- Canvas / structural types ---
export const COMPONENT_TYPE_PANEL = "panel";
export const COMPONENT_TYPE_NOTE = "note";
export const COMPONENT_TYPE_API_GROUP = "api-group";
export const COMPONENT_TYPE_ENDPOINT = "endpoint";
export const COMPONENT_TYPE_DB_TABLE = "db-table";
export const COMPONENT_TYPE_JSON_VIEWER = "json-viewer";

export const COMPONENT_TYPE_UNKNOWN = "unknown";

export const COMPONENT_TYPE_SVG = "svg";

export function isSvgComponentType(type: string): type is "svg" {
  return type === COMPONENT_TYPE_SVG;
}

/** All PanelKind values for runtime validation */
export const PANEL_KIND_VALUES: readonly PanelKind[] = [
  PanelKind.Default,
  PanelKind.AvailabilityZone,
  PanelKind.EksCluster,
  PanelKind.EcsCluster,
  PanelKind.AutoScalingGroup,
  PanelKind.Vpc,
  PanelKind.PublicSubnet,
  PanelKind.PrivateSubnet,
  PanelKind.Swimlane,
];

/** React Flow node `type` values that behave as parent panels (parenting / hit-testing). */
export function isReactFlowParentPanelType(nodeType: string): boolean {
  return nodeType === COMPONENT_TYPE_PANEL || nodeType === PanelKind.Swimlane;
}

// --- Type guards for ComponentType (string) ---

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

export function isDbTableType(type: string): type is "db-table" {
  return type === COMPONENT_TYPE_DB_TABLE;
}

export function isJsonViewerType(type: string): type is "json-viewer" {
  return type === COMPONENT_TYPE_JSON_VIEWER;
}

/** Runtime check that value is a valid PanelKind */
export function isPanelKind(value: string): value is PanelKind {
  return Object.values(PanelKind).includes(value as PanelKind);
}

// --- Usage key for analytics (element-usage-tracker) ---

export function getUsageKeyForType(
  type: ComponentType,
  panelKind?: PanelKind,
): string {
  if (isPanelType(type) || isNoteType(type)) {
    return `canvas:${type}${panelKind ? `:${panelKind}` : ""}`;
  }
  if (
    isEndpointType(type) ||
    isApiGroupType(type) ||
    isDbTableType(type) ||
    isJsonViewerType(type)
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

// --- Default name for new components ---

/**
 * Returns the default name when adding a new component of the given type.
 * For panels, pass the panel's defaultName from getPanelKindDef(kind).defaultName.
 */
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
  if (isPanelType(type) && panelDefaultName) return panelDefaultName;
  return i18n.t("quickInsert.newNamed", { name: label });
}
