import type { Diagram } from "@/features/diagram";
import type { WorkspaceManifest } from "./FileSystemAdapter";

// ── Result types ──

export type ValidationResult =
  | { valid: true; diagram: Diagram }
  | { valid: false; reason: string; raw: unknown };

export type ManifestValidationResult =
  | { valid: true; manifest: WorkspaceManifest }
  | { valid: false; reason: string };

// ── Diagram validator ──

export function validateDiagramFile(raw: unknown): ValidationResult {
  if (!raw || typeof raw !== "object") {
    return { valid: false, reason: "Arquivo não é um objeto JSON válido", raw };
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
        reason: `Campo obrigatório ausente ou inválido: "${field}" (esperado ${type})`,
        raw,
      };
    }
  }

  const snapshot = obj.snapshot as Record<string, unknown> | undefined;
  if (!snapshot || typeof snapshot !== "object") {
    return { valid: false, reason: 'Campo "snapshot" ausente ou inválido', raw };
  }
  for (const key of ["components", "connections", "flows"]) {
    if (!snapshot[key] || typeof snapshot[key] !== "object") {
      return {
        valid: false,
        reason: `snapshot.${key} ausente ou inválido`,
        raw,
      };
    }
  }

  if (!obj.nodeLayouts || typeof obj.nodeLayouts !== "object") {
    return {
      valid: false,
      reason: 'Campo "nodeLayouts" ausente ou inválido',
      raw,
    };
  }

  const vp = obj.viewport as Record<string, unknown> | undefined;
  if (
    !vp ||
    typeof vp.x !== "number" ||
    typeof vp.y !== "number" ||
    typeof vp.zoom !== "number"
  ) {
    return {
      valid: false,
      reason: 'Campo "viewport" ausente ou inválido (x, y, zoom)',
      raw,
    };
  }

  if (!(obj.id as string).trim()) {
    return { valid: false, reason: 'Campo "id" está vazio', raw };
  }

  return { valid: true, diagram: raw as Diagram };
}

// ── Manifest validator ──

export function validateManifest(raw: unknown): ManifestValidationResult {
  if (!raw || typeof raw !== "object") {
    return { valid: false, reason: "Manifest não é um objeto JSON válido" };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) {
    return {
      valid: false,
      reason: `Versão do manifest inválida: ${obj.version}`,
    };
  }
  if (!Array.isArray(obj.diagramIds)) {
    return {
      valid: false,
      reason: 'Campo "diagramIds" inválido no manifest',
    };
  }
  return { valid: true, manifest: raw as WorkspaceManifest };
}
