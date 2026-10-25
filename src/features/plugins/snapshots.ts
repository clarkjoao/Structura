import type {
  Component,
  ComponentPatch,
  Connection,
  Diagram,
  NodeLayout,
  ServiceDefinition,
} from "@/features/diagram";
import { resolveCloudServiceId } from "@/features/diagram/model/cloud-service-id";
import type { VersionDiff } from "@/features/diagram/model/diagram.types";
import {
  modifiedComponentsOf,
  modifiedConnectionsOf,
  resolveVersionSnapshot,
  versionConflicts,
} from "@/features/diagram/utils/version.utils";
import type {
  DiagramSnapshot,
  PluginComponentPatch,
  PluginComponentSnapshot,
  PluginConnectionSnapshot,
  PluginServicePatch,
  PluginServiceSnapshot,
  PluginVersionSnapshot,
} from "./plugin.types";

/**
 * Pure mappers between domain objects and the read-only projections plugins see.
 * Snapshot fields grow additively, by API minor version — never expose domain internals
 * (NodeBuildContext, store references, React Flow objects) here.
 */

export function toComponentSnapshot(
  component: Component,
  layout?: NodeLayout,
): PluginComponentSnapshot {
  const x = layout?.x ?? component.x;
  const y = layout?.y ?? component.y;
  // Read only: plugins change the catalog service through applyChanges, never here.
  const cloudServiceId = resolveCloudServiceId(component) ?? null;
  const technology =
    "technology" in component && typeof component.technology === "string"
      ? component.technology
      : null;
  return {
    id: component.id,
    type: component.type,
    label: component.name,
    description: component.description,
    parentId: component.parentId,
    position: x !== undefined && y !== undefined ? { x, y } : null,
    size:
      layout?.width !== undefined && layout?.height !== undefined
        ? { width: layout.width, height: layout.height }
        : null,
    tags: [...(component.tags ?? [])],
    serviceId: component.serviceId ?? null,
    cloudServiceId,
    technology,
    linkedDiagramId: component.linkedDiagramId ?? null,
  };
}

export function toConnectionSnapshot(connection: Connection): PluginConnectionSnapshot {
  return {
    id: connection.id,
    sourceId: connection.sourceId,
    targetId: connection.targetId,
    label: connection.label,
    description: connection.description ?? null,
    technology: connection.technology ?? null,
  };
}

export function toServiceSnapshot(service: ServiceDefinition): PluginServiceSnapshot {
  return {
    id: service.id,
    name: service.name,
    description: service.description,
    repositoryUrl: service.repositoryUrl,
    technology: [...service.technology],
    owner: service.owner ?? null,
    tags: [...(service.tags ?? [])],
  };
}

/**
 * The diagram as plugins read it. With `version: "active"` (what `getDiagram` asks for since
 * 1.14) the active Version is applied and named in `activeVersion`; `{ key }` applies that
 * Version (the base when there is none); otherwise the base.
 */
export function toDiagramSnapshot(
  diagram: Diagram,
  options: { version?: "active" | "base" | { key: string } } = {},
): DiagramSnapshot {
  const wanted = options.version;
  const version =
    wanted === "active"
      ? diagram.activeVersionId
        ? diagram.versions?.[diagram.activeVersionId]
        : undefined
      : typeof wanted === "object"
        ? Object.values(diagram.versions ?? {}).find((v) => v.key === wanted.key)
        : undefined;
  const resolved = resolveVersionSnapshot(diagram, version?.id ?? null);
  const snapshot: DiagramSnapshot = {
    id: diagram.id,
    name: diagram.name,
    description: diagram.description ?? null,
    components: Object.values(resolved.components).map((component) =>
      toComponentSnapshot(component, resolved.nodeLayouts[component.id]),
    ),
    connections: Object.values(resolved.connections).map(toConnectionSnapshot),
  };
  if (options.version !== undefined) {
    snapshot.activeVersion = version
      ? { id: version.id, key: version.key ?? null, status: version.status ?? null }
      : null;
  }
  return snapshot;
}

/** One Version as plugins see it. */
export function toVersionSnapshot(diagram: Diagram, version: VersionDiff): PluginVersionSnapshot {
  return {
    id: version.id,
    key: version.key ?? null,
    name: version.name,
    status: version.status ?? null,
    ownerPluginId: version.ownerPluginId ?? null,
    added: {
      componentIds: Object.keys(version.addedComponents),
      connectionIds: Object.keys(version.addedConnections),
    },
    modified: {
      componentIds: Object.keys(modifiedComponentsOf(version)),
      connectionIds: Object.keys(modifiedConnectionsOf(version)),
    },
    removed: {
      componentIds: [...version.removedComponentIds],
      connectionIds: [...version.removedConnectionIds],
    },
    conflicts: versionConflicts(diagram, version.id).map((c) => c.id),
  };
}

/** Reduce a plugin patch to the whitelisted component fields, dropping anything else. */
export function sanitizeComponentPatch(patch: PluginComponentPatch): ComponentPatch {
  const result: ComponentPatch = {};
  if (typeof patch.name === "string") result.name = patch.name;
  if (typeof patch.description === "string") result.description = patch.description;
  if (Array.isArray(patch.tags)) result.tags = patch.tags.filter((t) => typeof t === "string");
  return result;
}

/** Reduce a plugin patch to the whitelisted service fields, dropping anything else. */
export function sanitizeServicePatch(
  patch: PluginServicePatch,
): Partial<Omit<ServiceDefinition, "id">> {
  const result: Partial<Omit<ServiceDefinition, "id">> = {};
  if (typeof patch.name === "string") result.name = patch.name;
  if (typeof patch.description === "string") result.description = patch.description;
  if (typeof patch.repositoryUrl === "string") result.repositoryUrl = patch.repositoryUrl;
  if (typeof patch.owner === "string") result.owner = patch.owner;
  if (Array.isArray(patch.technology)) {
    result.technology = patch.technology.filter((t) => typeof t === "string");
  }
  if (Array.isArray(patch.tags)) result.tags = patch.tags.filter((t) => typeof t === "string");
  return result;
}
