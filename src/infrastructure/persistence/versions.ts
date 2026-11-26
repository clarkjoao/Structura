import type { Diagram } from "@/features/diagram";
import type { ServiceManifestEntry } from "@/features/diagram";

// Schema version para diagramas individuais
export const DIAGRAM_SCHEMA_VERSION = 1;
export const DIAGRAM_SCHEMA_URI = "structura://diagrams/v1" as const;

// Schema version para workspace/manifest
export const WORKSPACE_SCHEMA_VERSION = 2;

// Diagrama versionado (formato de export/import)
export interface VersionedDiagram {
  $schema: "structura://diagrams/v1";
  schemaVersion: number;
  data: Diagram;
  exportedAt?: string;
  /**
   * Identity of the services the diagram references, so the importing workspace can match
   * them against its own catalog. Optional and additive: readers that predate it ignore the
   * field, which is why `DIAGRAM_SCHEMA_VERSION` does not move for it.
   */
  services?: ServiceManifestEntry[];
}

// Manifest versionado
export interface VersionedManifest {
  version: number;
  createdAt: string;
  updatedAt: string;
  diagramIds: string[];
}

// Helper para criar diagrama versionado
export function createVersionedDiagram(
  diagram: Diagram,
  services?: ServiceManifestEntry[],
): VersionedDiagram {
  return {
    $schema: DIAGRAM_SCHEMA_URI,
    schemaVersion: DIAGRAM_SCHEMA_VERSION,
    data: diagram,
    exportedAt: new Date().toISOString(),
    ...(services && services.length > 0 ? { services } : {}),
  };
}

/** Dual-read legacy Scene fields onto Version fields (store schema v15). */
export function normalizeDiagramVersionFields(diagram: Record<string, unknown>): void {
  const legacyScenes = diagram.scenes;
  if (legacyScenes && typeof legacyScenes === "object" && !Array.isArray(legacyScenes)) {
    const existing = diagram.versions as Record<string, unknown> | undefined;
    const existingIsEmpty = !existing || Object.keys(existing).length === 0;
    if (existingIsEmpty) {
      diagram.versions = legacyScenes;
    }
  }
  delete diagram.scenes;

  if ("activeSceneId" in diagram) {
    if (diagram.activeVersionId === undefined) {
      diagram.activeVersionId = diagram.activeSceneId;
    }
    delete diagram.activeSceneId;
  }
  if ("compareSceneId" in diagram) {
    if (diagram.compareVersionId === undefined) {
      diagram.compareVersionId = diagram.compareSceneId;
    }
    delete diagram.compareSceneId;
  }
}

// Helper para detectar se é formato versionado
export function isVersionedDiagram(fileContent: unknown): boolean {
  if (!fileContent || typeof fileContent !== "object") return false;
  const obj = fileContent as Record<string, unknown>;
  return obj.$schema === DIAGRAM_SCHEMA_URI;
}
