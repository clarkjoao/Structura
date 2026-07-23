import type { PluginComponentSnapshot } from "../../types/plugin.types";
import type { BoundingBox, GeometryInfo } from "./types";
export type { BoundingBox };
import { CONFIG } from "./constants";

export const DRAWIO_MIN_MARGIN = 80;

const DEFAULT_ROOT_W = CONFIG.minDimensions.c4.width;
const DEFAULT_ROOT_H = CONFIG.minDimensions.c4.height;

/**
 * Get IDs of container components (panels, api groups)
 */
export function getContainerIds(components: readonly PluginComponentSnapshot[]): Set<string> {
  const ids = new Set<string>();
  for (const c of components) {
    if (isPanelComponent(c) || isApiGroupComponent(c)) {
      ids.add(c.id);
    }
  }
  return ids;
}

/**
 * Check if a component is a root export node
 */
export function isRootExportNode(
  c: PluginComponentSnapshot | undefined,
  containerIds: Set<string>,
): boolean {
  if (!c) return true;
  return !c.parentId || !containerIds.has(c.parentId);
}

/**
 * Compute bounding box for given components
 */
export function computeBoundingBox(
  components: readonly PluginComponentSnapshot[],
  containerIds: Set<string>,
): BoundingBox {
  const rootComponents = components.filter((c) => isRootExportNode(c, containerIds));
  const componentsForBbox = rootComponents.length > 0 ? rootComponents : [...components];

  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const c of componentsForBbox) {
    if (!c.position) continue;
    const w = c.size?.width ?? DEFAULT_ROOT_W;
    const h = c.size?.height ?? DEFAULT_ROOT_H;
    minX = Math.min(minX, c.position.x);
    minY = Math.min(minY, c.position.y);
    maxX = Math.max(maxX, c.position.x + w);
    maxY = Math.max(maxY, c.position.y + h);
  }

  if (minX === Infinity) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0, width: 0, height: 0 };
  }

  return {
    minX,
    minY,
    maxX,
    maxY,
    width: maxX - minX,
    height: maxY - minY,
  };
}

/**
 * Get export geometry from component
 */
export function getExportGeometry(c: PluginComponentSnapshot): GeometryInfo {
  if (!c.position) {
    return { x: 0, y: 0, width: 0, height: 0 };
  }
  return {
    x: c.position.x,
    y: c.position.y,
    width: c.size?.width ?? 0,
    height: c.size?.height ?? 0,
  };
}

// Type guards for component types
export function isPanelComponent(c: PluginComponentSnapshot): boolean {
  return c.type === "panel" || c.type === "group" || c.type.includes("panel");
}

export function isApiGroupComponent(c: PluginComponentSnapshot): boolean {
  return c.type === "apiGroup" || c.type === "api-group" || c.type.includes("api");
}

export function isAwsComponent(c: PluginComponentSnapshot): boolean {
  return c.type.startsWith("aws-") || c.serviceId?.startsWith("aws-") || false;
}

export function isC4Component(c: PluginComponentSnapshot): boolean {
  const type = c.type.toLowerCase();
  return type === "person" || type === "system" || type === "container" || type === "component";
}

export function isEndpointComponent(c: PluginComponentSnapshot): boolean {
  return c.type === "endpoint" || c.type === "api-endpoint" || c.type.includes("endpoint");
}

export function isNoteComponent(c: PluginComponentSnapshot): boolean {
  return c.type === "note";
}

export function isDbTableComponent(c: PluginComponentSnapshot): boolean {
  return c.type === "dbTable" || c.type === "database" || c.type.includes("table");
}

export function isJsonViewerComponent(c: PluginComponentSnapshot): boolean {
  return c.type === "jsonViewer" || c.type === "json" || c.type.includes("json");
}
