import { hasElement } from "@/features/elements/element.registry";
import type { ComponentType } from "./component.types";

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
 * Recover a cloud category that no longer exists as a concrete id.
 *
 * Scope is deliberately narrow (F9): if the persisted string still carries a
 * recognised provider prefix (`aws-` / `gcp-` / `azure-`) but the specific
 * category is gone, land on that family's `*-general` bucket when it is
 * registered. No fuzzy matching beyond the prefix.
 */
function recoverCloudCategoryPrefix(value: string): ComponentType | undefined {
  const general =
    value.startsWith("aws-") && value !== "aws-general"
      ? "aws-general"
      : value.startsWith("gcp-") && value !== "gcp-general"
        ? "gcp-general"
        : value.startsWith("azure-") && value !== "azure-general"
          ? "azure-general"
          : undefined;
  if (general === undefined) return undefined;
  return hasElement(general) ? (general as ComponentType) : undefined;
}

/**
 * Sanitize a `type` value (string from raw JSON) into a `ComponentType`.
 *
 * - Registered element ids are returned as-is.
 * - Plugin namespaced types matching `<pluginId>/<name>` are returned as-is
 *   (they degrade to the unknown descriptor at render time when the plugin
 *   is missing).
 * - Cloud-shaped unknowns recover to `*-general` when the prefix is clear.
 * - Anything else falls back to `"unknown"` (F9 / decision 4 — was
 *   `"component"` via the catch-all).
 *
 * Use this whenever a `type` string is read from persisted state or from an
 * external source (template save, JSON import, drawio import).
 */
export function sanitizeComponentType(value: unknown): ComponentType {
  if (typeof value !== "string" || value.length === 0) return "unknown";
  if (hasElement(value)) return value as ComponentType;
  if (PLUGIN_COMPONENT_TYPE_PATTERN.test(value)) return value as ComponentType;
  const recovered = recoverCloudCategoryPrefix(value);
  if (recovered !== undefined) return recovered;
  return "unknown";
}
