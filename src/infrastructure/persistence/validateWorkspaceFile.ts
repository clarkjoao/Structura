import type { Diagram } from "@/features/diagram";
import { normalizeImportedDiagram } from "@/lib/export-service/normalize-imported-diagram";
import type { WorkspaceManifest } from "./FileSystemAdapter";

export type ValidationResult =
  { valid: true; diagram: Diagram } | { valid: false; reason: string; raw: unknown };

export type ManifestValidationResult =
  { valid: true; manifest: WorkspaceManifest } | { valid: false; reason: string };

/** Deletion marker written when physical file removal fails (see FileSystemAdapter.deleteDiagram). */
export function isDiagramTombstoneJson(raw: unknown): boolean {
  if (!raw || typeof raw !== "object") return false;
  return (raw as Record<string, unknown>).deleted === true;
}

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

  const requiredFields: Array<[string, string]> = [
    ["id", "string"],
    ["name", "string"],
    ["level", "string"],
    ["createdAt", "string"],
    ["updatedAt", "string"],
  ];

  for (const [field, type] of requiredFields) {
    if (typeof obj[field] !== type) {
      return {
        valid: false,
        reason: `Missing or invalid required field: "${field}" (expected ${type})`,
        raw,
      };
    }
  }

  const snapshot = obj.snapshot as Record<string, unknown> | undefined;
  if (!snapshot || typeof snapshot !== "object") {
    return { valid: false, reason: 'Missing or invalid "snapshot" field', raw };
  }
  for (const key of ["components", "connections", "flows"]) {
    if (!snapshot[key] || typeof snapshot[key] !== "object") {
      return {
        valid: false,
        reason: `snapshot.${key} is missing or invalid`,
        raw,
      };
    }
  }

  if (!obj.nodeLayouts || typeof obj.nodeLayouts !== "object") {
    return {
      valid: false,
      reason: 'Missing or invalid "nodeLayouts" field',
      raw,
    };
  }

  const vp = obj.viewport as Record<string, unknown> | undefined;
  if (!vp || typeof vp.x !== "number" || typeof vp.y !== "number" || typeof vp.zoom !== "number") {
    return {
      valid: false,
      reason: 'Missing or invalid "viewport" (x, y, zoom)',
      raw,
    };
  }

  if (!(obj.id as string).trim()) {
    return { valid: false, reason: '"id" field is empty', raw };
  }

  return { valid: true, diagram: normalizeImportedDiagram(raw as Diagram) };
}

export function validateManifest(raw: unknown): ManifestValidationResult {
  if (!raw || typeof raw !== "object") {
    return { valid: false, reason: "Manifest is not a valid JSON object" };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) {
    return {
      valid: false,
      reason: `Invalid manifest version: ${obj.version}`,
    };
  }
  if (!Array.isArray(obj.diagramIds)) {
    return {
      valid: false,
      reason: 'Invalid "diagramIds" field in manifest',
    };
  }
  return { valid: true, manifest: raw as WorkspaceManifest };
}
