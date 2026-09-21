import type { Diagram, Folder, ServiceDefinition } from "@/features/diagram";
import { exportDrawio } from "./export-drawio";
import { exportJSON } from "./export-json";
import { exportMermaid } from "./export-mermaid";
import type { DiagramExportFormat } from "./build-export-files";
import type { ZipEntryFile } from "./download-file";

export interface WorkspaceExportOptions {
  diagrams: Diagram[];
  formats: DiagramExportFormat[];
  services: Record<string, ServiceDefinition>;
  folders: Record<string, Folder>;
}

const FORMAT_EXTENSION: Record<DiagramExportFormat, string> = {
  json: "json",
  drawio: "drawio",
  mermaid: "md",
};

/**
 * Lowercase, replace spaces with hyphens, remove special chars, collapse runs of
 * hyphens, and trim leading/trailing hyphens.
 */
function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Walk up the folder tree building the prefix from each ancestor's sanitized name,
 * joined with hyphens.
 */
function getFolderPrefix(folderId: string | null | undefined, folders: Record<string, Folder>): string {
  if (!folderId) return "";
  const parts: string[] = [];
  let currentId: string | null | undefined = folderId;
  while (currentId) {
    const folder = folders[currentId];
    if (!folder) break;
    parts.unshift(sanitizeFilename(folder.name));
    currentId = folder.parentId;
  }
  return parts.join("-");
}

/**
 * Build the filename for a single diagram export entry.
 */
function buildFilename(baseName: string, format: DiagramExportFormat, folderPrefix: string): string {
  const ext = FORMAT_EXTENSION[format];
  const suffix = format === "mermaid" ? "-flows" : "";
  const prefix = folderPrefix ? `${folderPrefix}_` : "";
  return `${prefix}${baseName}${suffix}.${ext}`;
}

/**
 * Generate zip entries for bulk workspace export with folder-preserving paths.
 * One file per format per diagram is produced; mermaid is always included
 * regardless of whether the diagram has flows.
 */
export function buildWorkspaceExportFiles({
  diagrams,
  formats,
  services,
  folders,
}: WorkspaceExportOptions): ZipEntryFile[] {
  if (diagrams.length === 0) return [];

  const entries: ZipEntryFile[] = [];

  for (const diagram of diagrams) {
    const baseName = sanitizeFilename(diagram.name);
    const folderPrefix = getFolderPrefix(diagram.folderId, folders);

    for (const format of formats) {
      const filename = buildFilename(baseName, format, folderPrefix);
      const content = buildExportContent(diagram, format, services);
      entries.push({ filename, content });
    }
  }

  return entries;
}

function buildExportContent(
  diagram: Diagram,
  format: DiagramExportFormat,
  services: Record<string, ServiceDefinition>,
): string {
  switch (format) {
    case "json":
      return exportJSON(diagram, services);
    case "drawio":
      return exportDrawio(diagram, services);
    case "mermaid":
      // Always export mermaid; returns empty string when there are no flows.
      return exportMermaid(
        Object.values(diagram.snapshot.flows),
        diagram.snapshot.components,
        diagram.snapshot.connections,
      );
  }
}
