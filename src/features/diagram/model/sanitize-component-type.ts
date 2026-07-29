import type { ComponentType } from "./component.types";

/**
 * Built-in component types that can be the base of a template AND a
 * component's `type` field. Anything outside this list (and not a
 * plugin namespaced type) is sanitised to "component" so corrupted
 * `type` values don't slip through and trigger the unknown descriptor.
 * Keep in sync with the non-Aws/Gcp/Azure/Plugin members of the
 * ComponentType union in component.types.ts.
 */
export const BUILTIN_COMPONENT_TYPES: ReadonlySet<string> = new Set<string>([
  "person",
  "system",
  "container",
  "component",
  "panel",
  "note",
  "api-group",
  "endpoint",
  "unknown",
  "svg",
  "db-table",
  "json-viewer",
  "process-node",
  "external-element",
]);

/**
 * Plugin namespaced ComponentType pattern: `<pluginId>/<name>` where both
 * segments are alphanumeric (plus `_`, `-`, `.`). Plugin ids come from
 * the plugin registry's manifests and never contain spaces, slashes,
 * or punctuation outside these characters. The point of this regex is
 * to *reject* ordinary component data that just happens to contain a
 * slash (e.g. "API Endpoints /api/v1 · REST") — those strings would
 * otherwise be mistaken for plugin types and degrade to the unknown
 * descriptor.
 */
const PLUGIN_COMPONENT_TYPE_PATTERN = /^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/;

/**
 * Sanitize a `type` value (string from raw JSON) into a `ComponentType`.
 * - Built-in types are returned as-is.
 * - Plugin namespaced types matching `<pluginId>/<name>` are returned
 *   as-is (they degrade to the unknown descriptor at render time when
 *   the plugin is missing).
 * - Anything else falls back to "component" so the rest of the app
 *   can keep working without branch-specific knowledge of the
 *   corruption.
 *
 * Use this whenever a `type` string is read from persisted state or
 * from an external source (template save, JSON import, drawio import).
 */
export function sanitizeComponentType(value: unknown): ComponentType {
  if (typeof value !== "string" || value.length === 0) return "component";
  if (BUILTIN_COMPONENT_TYPES.has(value)) return value as ComponentType;
  if (PLUGIN_COMPONENT_TYPE_PATTERN.test(value)) return value as ComponentType;
  return "component";
}
