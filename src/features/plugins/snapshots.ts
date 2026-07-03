import type {
  Component,
  ComponentPatch,
  Connection,
  Diagram,
  NodeLayout,
  ServiceDefinition,
} from "@/features/diagram";
import type {
  DiagramSnapshot,
  PluginComponentPatch,
  PluginComponentSnapshot,
  PluginConnectionSnapshot,
  PluginServicePatch,
  PluginServiceSnapshot,
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
    serviceId: component.registryServiceId ?? component.serviceId ?? null,
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

export function toDiagramSnapshot(diagram: Diagram): DiagramSnapshot {
  return {
    id: diagram.id,
    name: diagram.name,
    description: diagram.description ?? null,
    components: Object.values(diagram.snapshot.components).map((component) =>
      toComponentSnapshot(component, diagram.nodeLayouts[component.id]),
    ),
    connections: Object.values(diagram.snapshot.connections).map(toConnectionSnapshot),
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
