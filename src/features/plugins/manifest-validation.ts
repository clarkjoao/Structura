import {
  KNOWN_PLUGIN_CAPABILITIES,
  STRUCTURA_PLUGIN_API_VERSION,
  type PluginCapability,
  type PluginManifest,
} from "./plugin.types";
import { isValidSemver, isValidSemverRange, semverSatisfies } from "./semver";

/**
 * Machine-readable validation errors; the UI layer maps `code` to i18n keys.
 * `field` names the offending manifest field, `detail` carries values for interpolation.
 */
export interface ManifestValidationError {
  code:
    | "not-an-object"
    | "missing-field"
    | "invalid-semver"
    | "invalid-api-range"
    | "incompatible-api-version"
    | "unknown-capability"
    | "duplicate-id";
  field?: string;
  detail?: string;
}

export type ManifestValidationResult =
  { ok: true; manifest: PluginManifest } | { ok: false; errors: ManifestValidationError[] };

const REQUIRED_STRING_FIELDS = [
  "id",
  "name",
  "version",
  "author",
  "description",
  "apiVersion",
] as const;

function isKnownCapability(value: unknown): value is PluginCapability {
  return (
    typeof value === "string" && (KNOWN_PLUGIN_CAPABILITIES as readonly string[]).includes(value)
  );
}

export function validatePluginManifest(
  candidate: unknown,
  installedIds: readonly string[],
  currentApiVersion: string = STRUCTURA_PLUGIN_API_VERSION,
): ManifestValidationResult {
  if (typeof candidate !== "object" || candidate === null || Array.isArray(candidate)) {
    return { ok: false, errors: [{ code: "not-an-object" }] };
  }

  const raw = candidate as Record<string, unknown>;
  const errors: ManifestValidationError[] = [];

  for (const field of REQUIRED_STRING_FIELDS) {
    const value = raw[field];
    if (typeof value !== "string" || value.trim() === "") {
      errors.push({ code: "missing-field", field });
    }
  }

  const version = raw.version;
  if (typeof version === "string" && version.trim() !== "" && !isValidSemver(version)) {
    errors.push({ code: "invalid-semver", field: "version", detail: version });
  }

  const apiVersion = raw.apiVersion;
  if (typeof apiVersion === "string" && apiVersion.trim() !== "") {
    if (!isValidSemverRange(apiVersion)) {
      errors.push({ code: "invalid-api-range", field: "apiVersion", detail: apiVersion });
    } else if (!semverSatisfies(currentApiVersion, apiVersion)) {
      errors.push({
        code: "incompatible-api-version",
        field: "apiVersion",
        detail: apiVersion,
      });
    }
  }

  const capabilities = raw.capabilities;
  if (!Array.isArray(capabilities)) {
    errors.push({ code: "missing-field", field: "capabilities" });
  } else {
    for (const capability of capabilities) {
      if (!isKnownCapability(capability)) {
        errors.push({
          code: "unknown-capability",
          field: "capabilities",
          detail: String(capability),
        });
      }
    }
  }

  const id = raw.id;
  if (typeof id === "string" && installedIds.includes(id)) {
    errors.push({ code: "duplicate-id", field: "id", detail: id });
  }

  const entry = raw.entry;
  if (errors.length > 0) return { ok: false, errors };

  return {
    ok: true,
    manifest: {
      id: id as string,
      name: raw.name as string,
      version: version as string,
      author: raw.author as string,
      description: raw.description as string,
      apiVersion: apiVersion as string,
      capabilities: (capabilities as unknown[]).filter(isKnownCapability),
      ...(typeof entry === "string" ? { entry } : {}),
      ...(Array.isArray(raw.uses) ? { uses: raw.uses as string[] } : {}),
    },
  };
}
