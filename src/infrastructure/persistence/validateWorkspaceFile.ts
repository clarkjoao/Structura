import type { Diagram, ServiceManifestEntry } from "@/features/diagram";
import { normalizeImportedDiagram } from "@/lib/export-service/normalize-imported-diagram";
import type { WorkspaceManifest } from "./FileSystemAdapter";
import { DIAGRAM_SCHEMA_VERSION, DIAGRAM_SCHEMA_URI } from "./versions";
import { migrateDiagram } from "./migrations";

export type ValidationResult =
  | {
      valid: true;
      diagram: Diagram;
      /**
       * Identity of the services the file references, when it carries a manifest. Absent for
       * files exported before the manifest existed; the importer falls back to component
       * evidence in that case.
       */
      services?: ServiceManifestEntry[];
    }
  | { valid: false; reason: string; raw: unknown };

export type ManifestValidationResult =
  { valid: true; manifest: WorkspaceManifest } | { valid: false; reason: string };

/** Deletion marker written when physical file removal fails (see FileSystemAdapter.deleteDiagram). */
export function isDiagramTombstoneJson(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  return (raw as Record<string, unknown>).deleted === true;
}

/**
 * Validates and extracts a diagram from raw JSON.
 * Handles both versioned (new) and legacy (old) formats.
 */
export function validateDiagramFile(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { valid: false, reason: "File is not a valid JSON object", raw };
  }

  if (isDiagramTombstoneJson(raw)) {
    return {
      valid: false,
      reason: "Diagram file is a deletion tombstone",
      raw,
    };
  }

  const obj = raw as Record<string, unknown>;
  let diagram: Diagram;

  // Check if it's a versioned diagram (new format)
  if (obj.$schema === DIAGRAM_SCHEMA_URI && obj.data) {
    // New versioned format
    const versioned = obj as { schemaVersion?: number; data: unknown };
    const schemaVersion = versioned.schemaVersion ?? 0;

    // Future: check for unsupported future versions
    if (schemaVersion > DIAGRAM_SCHEMA_VERSION) {
      return {
        valid: false,
        reason: `Unsupported diagram schema version: ${schemaVersion}`,
        raw,
      };
    }

    // Apply migrations if needed
    diagram = migrateDiagram(versioned.data as Diagram, schemaVersion);
  } else {
    // Legacy format (no $schema) - treat as schema version 0
    const legacy = extractLegacyDiagram(obj);
    if (!legacy) {
      return { valid: false, reason: "Invalid diagram format", raw };
    }
    diagram = legacy;
  }

  // Validate required fields
  const validation = validateDiagramFields(diagram);
  if (!validation.valid) {
    return validation;
  }

  const services = extractServiceManifest(raw);

  return {
    valid: true,
    diagram: normalizeImportedDiagram(validation.diagram),
    ...(services ? { services } : {}),
  };
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function toStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter(isNonEmptyString) : [];
}

function extractGithubIdentity(value: unknown): ServiceManifestEntry["github"] {
  if (!value || typeof value !== "object") return undefined;
  const github = value as Record<string, unknown>;
  if (typeof github.repoId !== "number" || !Number.isFinite(github.repoId)) return undefined;
  if (typeof github.fullName !== "string") return undefined;
  return { repoId: github.repoId, fullName: github.fullName };
}

/**
 * Read the optional service manifest from the envelope. Entries are validated field by field:
 * the file is user-supplied and a malformed entry must degrade to "no manifest" rather than
 * reach the matcher.
 */
function extractServiceManifest(raw: unknown): ServiceManifestEntry[] | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const services = (raw as Record<string, unknown>).services;
  if (!Array.isArray(services)) return undefined;

  const entries: ServiceManifestEntry[] = [];
  for (const candidate of services) {
    if (!candidate || typeof candidate !== "object") continue;
    const entry = candidate as Record<string, unknown>;
    if (!isNonEmptyString(entry.id) || typeof entry.name !== "string") continue;

    const github = extractGithubIdentity(entry.github);
    entries.push({
      id: entry.id,
      name: entry.name,
      repositoryUrl: typeof entry.repositoryUrl === "string" ? entry.repositoryUrl : "",
      technology: toStringArray(entry.technology),
      ...(isNonEmptyString(entry.owner) ? { owner: entry.owner } : {}),
      ...(toStringArray(entry.tags).length > 0 ? { tags: toStringArray(entry.tags) } : {}),
      ...(github ? { github } : {}),
    });
  }

  return entries.length > 0 ? entries : undefined;
}

/**
 * Extract a diagram from legacy (unversioned) format.
 */
function extractLegacyDiagram(obj: Record<string, unknown>): Diagram | null {
  // Legacy format has id, snapshot, nodeLayouts, viewport at root level
  if (obj.id && obj.snapshot && obj.nodeLayouts && obj.viewport) {
    return obj as unknown as Diagram;
  }
  return null;
}

/**
 * Validates the core fields of a diagram.
 * Missing `createdAt` / `updatedAt` are tolerated and default to now —
 * legacy exports and re-imports are common and a missing timestamp
 * shouldn't block the whole diagram.
 */
function validateDiagramFields(diagram: Diagram): ValidationResult {
  // String fields
  for (const field of ["id", "name", "level"] as const) {
    if (typeof diagram[field] !== "string" || !diagram[field].trim()) {
      return {
        valid: false,
        reason: `Missing or invalid required field: "${field}"`,
        raw: diagram,
      };
    }
  }

  // Timestamps default to now when missing or null. We log a dev warning
  // so stale partial exports surface in the console. String values (ISO
  // date) are coerced via Date.parse so external tools that produce
  // string timestamps still import cleanly.
  const now = Date.now();
  const rawDiagram = diagram as Diagram & { createdAt?: unknown; updatedAt?: unknown };
  const coerceToNumber = (value: unknown): number | null => {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const parsed = Date.parse(value);
      if (Number.isFinite(parsed)) return parsed;
    }
    return null;
  };
  let createdAt: number | null = coerceToNumber(rawDiagram.createdAt);
  let updatedAt: number | null = coerceToNumber(rawDiagram.updatedAt);
  if (rawDiagram.createdAt === undefined || rawDiagram.createdAt === null) {
    if (typeof window !== "undefined" && import.meta.env?.DEV) {
      console.warn("[validateDiagramFile] createdAt missing, defaulting to now");
    }
    createdAt = now;
  }
  if (rawDiagram.updatedAt === undefined || rawDiagram.updatedAt === null) {
    if (typeof window !== "undefined" && import.meta.env?.DEV) {
      console.warn("[validateDiagramFile] updatedAt missing, defaulting to now");
    }
    updatedAt = now;
  }
  if (createdAt === null) {
    return {
      valid: false,
      reason: 'Missing or invalid required field: "createdAt"',
      raw: diagram,
    };
  }
  if (updatedAt === null) {
    return {
      valid: false,
      reason: 'Missing or invalid required field: "updatedAt"',
      raw: diagram,
    };
  }

  // Snapshot validation
  const snapshot = diagram.snapshot;
  if (!snapshot || typeof snapshot !== "object") {
    return { valid: false, reason: 'Missing or invalid "snapshot" field', raw: diagram };
  }
  for (const key of ["components", "connections", "flows"] as const) {
    if (!snapshot[key] || typeof snapshot[key] !== "object") {
      return {
        valid: false,
        reason: `snapshot.${key} is missing or invalid`,
        raw: diagram,
      };
    }
  }

  // nodeLayouts validation
  if (!diagram.nodeLayouts || typeof diagram.nodeLayouts !== "object") {
    return {
      valid: false,
      reason: 'Missing or invalid "nodeLayouts" field',
      raw: diagram,
    };
  }

  // Viewport validation
  const vp = diagram.viewport;
  if (
    !vp ||
    typeof vp !== "object" ||
    typeof vp.x !== "number" ||
    typeof vp.y !== "number" ||
    typeof vp.zoom !== "number"
  ) {
    return {
      valid: false,
      reason: 'Missing or invalid "viewport" (x, y, zoom)',
      raw: diagram,
    };
  }

  return { valid: true, diagram: { ...diagram, createdAt, updatedAt } };
}

/**
 * Validates a workspace manifest.
 * Supports version 1 (legacy) and version 2 (new).
 */
export function validateManifest(raw: unknown): ManifestValidationResult {
  if (!raw || typeof raw !== "object") {
    return { valid: false, reason: "Manifest is not a valid JSON object" };
  }
  const obj = raw as Record<string, unknown>;

  // Support version 1 (legacy) and version 2 (new)
  const version = obj.version as number;
  if (version !== 1 && version !== 2) {
    return {
      valid: false,
      reason: `Invalid manifest version: ${version}. Expected 1 or 2.`,
    };
  }

  if (!Array.isArray(obj.diagramIds)) {
    return {
      valid: false,
      reason: 'Invalid "diagramIds" field in manifest',
    };
  }

  // Future: apply manifest migrations if needed
  return { valid: true, manifest: raw as WorkspaceManifest };
}
