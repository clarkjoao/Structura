import type { Component, ComponentPatch, ComponentType } from "@/features/diagram";
import { sanitizeComponentType } from "@/features/diagram";
import { allElements, getElement } from "@/features/elements/element.registry";
import type { ElementPreset } from "../types";

/**
 * Minimal node shape needed to seed an element preset.
 * Intentionally not a React Flow `Node` — keeps this feature free of `@xyflow/react`.
 */
export interface PresetSourceNode {
  type?: string;
  data?: unknown;
}

/**
 * Fields every component carries whatever its type — `BaseComponent`, minus the
 * identity the store owns (`id`, `type`) and the geometry the layout owns.
 *
 * A descriptor does not declare these because they are not type-specific, so
 * they are the one part of the allowlist that cannot be derived.
 */
const BASE_PATCHABLE_KEYS: readonly string[] = [
  "name",
  "description",
  "parentId",
  "customIconId",
  "tags",
  "serviceId",
  "linkedDiagramId",
  "hidden",
  "handleOrder",
  "externalLinks",
  "templateId",
];

/**
 * The fields a preset of `type` may carry.
 *
 * Derived from the element registry rather than hand-listed. The hand-written
 * list this replaced had drifted from what the descriptors declare, and the
 * drift was silent data loss: `svgContent` and `flowShape` — both required for
 * their component to render — were declared `patchableKeys` and missing from
 * the list, so saving a preset of an `svg` or `process-node` threw the defining
 * field away. Deriving makes that class of bug impossible: a new element's
 * fields are covered the moment it declares them.
 *
 * An unregistered type (a plugin, or a registry that has not bootstrapped yet)
 * has no declaration to read, so it falls back to the union of every registered
 * element's keys — bounded like the old list, and still incapable of drifting.
 */
function patchableKeysForType(type: string): Set<string> {
  const descriptor = getElement(type);
  const declared = descriptor
    ? descriptor.model.patchableKeys
    : allElements().flatMap((element) => element.model.patchableKeys);
  return new Set<string>([...BASE_PATCHABLE_KEYS, ...declared]);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (typeof value === "object" && value !== null) {
    return value as Record<string, unknown>;
  }
  return {};
}

function resolveBaseType(node: PresetSourceNode, nodeData: Record<string, unknown>): ComponentType {
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

function presetRecordFromDomainComponent(component: Component): Record<string, unknown> {
  const skipKeys = new Set<string>(["id", "templateId"]);
  const allowed = patchableKeysForType(component.type);
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(component)) {
    if (skipKeys.has(key)) {
      continue;
    }
    if (value === undefined) {
      continue;
    }
    if (key === "type" || allowed.has(key)) {
      next[key] = value;
    }
  }
  // Sanitize the type so a corrupted component.type (e.g. "API Endpoints
  // /api/v1 · REST" from a previous preset-replication cycle) doesn't
  // get persisted as the preset's baseType.
  next.type = sanitizeComponentType(component.type);
  return removeUndefinedEntries(next);
}

function presetRecordFromStrippedNodeData(
  nodeData: Record<string, unknown>,
  baseType: ComponentType,
): Record<string, unknown> {
  const allowed = patchableKeysForType(baseType);
  const next: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(nodeData)) {
    if (NODE_DATA_UI_ONLY_KEYS.has(key)) {
      continue;
    }
    if (value === undefined) {
      continue;
    }
    if (key === "type" || allowed.has(key)) {
      next[key] = value;
    }
  }
  next.type = baseType;
  return removeUndefinedEntries(next);
}

export function createPresetDataFromNode(
  node: PresetSourceNode,
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
    ? presetRecordFromDomainComponent(domainComponent)
    : presetRecordFromStrippedNodeData(nodeData, baseType);

  return {
    baseType,
    data,
    serviceId,
  };
}

export function buildComponentPatchFromPreset(
  preset: ElementPreset,
  hasRegistryService: boolean,
): ComponentPatch {
  const allowed = patchableKeysForType(preset.baseType);
  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(preset.data)) {
    if (!allowed.has(key)) continue;
    patch[key] = value;
  }
  patch.templateId = preset.id;
  if (preset.serviceId && hasRegistryService) {
    patch.serviceId = preset.serviceId;
  } else {
    patch.serviceId = undefined;
  }
  return patch as ComponentPatch;
}
