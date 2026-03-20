/**
 * Central constants and type guards for ComponentType and PanelKind.
 * Use these instead of string literals (e.g. type === "panel") across the codebase.
 */
import type { ComponentType, PanelKind } from "./component.types";
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

/** Types that use the "canvas:…" usage key and support panelKind in key */
export const CANVAS_PANEL_NOTE_TYPES = [COMPONENT_TYPE_PANEL, COMPONENT_TYPE_NOTE] as const;

/** Types that use the "canvas:…" usage key without panelKind */
export const CANVAS_API_TYPES = [COMPONENT_TYPE_API_GROUP, COMPONENT_TYPE_ENDPOINT] as const;

/** All PanelKind values for runtime validation */
export const PANEL_KIND_VALUES: readonly PanelKind[] = [
  "default",
  "availability-zone",
  "eks-cluster",
  "ecs-cluster",
  "auto-scaling-group",
  "vpc",
  "public-subnet",
  "private-subnet",
];

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

export function isSystemType(type: string): type is "system" {
  return type === "system";
}

export function isContainerType(type: string): type is "container" {
  return type === "container";
}

export function isEndpointType(type: string): type is "endpoint" {
  return type === COMPONENT_TYPE_ENDPOINT;
}

export function isApiGroupType(type: string): type is "api-group" {
  return type === COMPONENT_TYPE_API_GROUP;
}

export function isCanvasStructuralType(type: string): type is "panel" | "note" {
  return isPanelType(type) || isNoteType(type);
}

export function isCanvasApiType(type: string): type is "api-group" | "endpoint" {
  return isApiGroupType(type) || isEndpointType(type);
}

/** Runtime check that value is a valid PanelKind */
export function isPanelKind(value: string): value is PanelKind {
  return (PANEL_KIND_VALUES as readonly string[]).includes(value);
}

// --- Usage key for analytics (element-usage-tracker) ---

export function getUsageKeyForType(
  type: ComponentType,
  panelKind?: PanelKind,
): string {
  if (isPanelType(type) || isNoteType(type)) {
    return `canvas:${type}${panelKind ? `:${panelKind}` : ""}`;
  }
  if (isEndpointType(type) || isApiGroupType(type)) {
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
  if (isPanelType(type) && panelDefaultName) return panelDefaultName;
  return i18n.t("quickInsert.newNamed", { name: label });
}
