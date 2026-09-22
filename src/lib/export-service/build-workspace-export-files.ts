import type { Diagram, Folder, ServiceDefinition } from "@/features/diagram";
import { exportDrawio } from "./export-drawio";
import { exportJSON } from "./export-json";
import { exportMermaid } from "./export-mermaid";
import type { DiagramExportFormat } from "./build-export-files";
import type { ZipEntryFile } from "./download-file";

export interface WorkspaceExportPlanOptions {
  diagrams: Diagram[];
  formats: DiagramExportFormat[];
  folders: Record<string, Folder>;
}

export interface WorkspaceExportOptions extends WorkspaceExportPlanOptions {
  services: Record<string, ServiceDefinition>;
}

/** One file the bulk export will write: which diagram, in which format, under which name. */
export interface WorkspaceExportEntry {
  diagram: Diagram;
  format: DiagramExportFormat;
  filename: string;
}

const FORMAT_EXTENSION: Record<DiagramExportFormat, string> = {
  json: "json",
  drawio: "drawio",
  mermaid: "md",
};

const UNTITLED = "untitled";

/**
 * Fold accents (so "Catálogo" keeps its letters), lowercase, turn anything that is not
 * a-z/0-9 into a hyphen, collapse runs of hyphens and trim them from both ends.
 */
function sanitizeFilename(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Walk up the folder tree building the prefix from each ancestor's sanitized name,
 * joined with hyphens. Guards against a parent cycle in corrupted data.
 */
function getFolderPrefix(
  folderId: string | null | undefined,
  folders: Record<string, Folder>,
): string {
  const parts: string[] = [];
  const seen = new Set<string>();
  let currentId: string | null | undefined = folderId;
  while (currentId && !seen.has(currentId)) {
    seen.add(currentId);
    const folder: Folder | undefined = folders[currentId];
    if (!folder) break;
    parts.unshift(sanitizeFilename(folder.name) || UNTITLED);
    currentId = folder.parentId;
  }
  return parts.join("-");
}

function buildStem(diagram: Diagram, folders: Record<string, Folder>): string {
  const baseName = sanitizeFilename(diagram.name) || UNTITLED;
  const folderPrefix = getFolderPrefix(diagram.folderId, folders);
  return folderPrefix ? `${folderPrefix}_${baseName}` : baseName;
}

/**
 * Name every file the bulk export will write, without building any content — cheap
 * enough to drive a live preview. Diagrams whose names collide after sanitizing get
 * `-2`, `-3`… so no entry overwrites another inside the zip; all formats of one
 * diagram share the same stem.
 */
export function planWorkspaceExport({
  diagrams,
  formats,
  folders,
}: WorkspaceExportPlanOptions): WorkspaceExportEntry[] {
  const entries: WorkspaceExportEntry[] = [];
  const usedStems = new Set<string>();

  for (const diagram of diagrams) {
    const stem = buildStem(diagram, folders);
    let uniqueStem = stem;
    for (let n = 2; usedStems.has(uniqueStem); n += 1) uniqueStem = `${stem}-${n}`;
    usedStems.add(uniqueStem);

    for (const format of formats) {
      const suffix = format === "mermaid" ? "-flows" : "";
      entries.push({
        diagram,
        format,
        filename: `${uniqueStem}${suffix}.${FORMAT_EXTENSION[format]}`,
      });
    }
  }

  return entries;
}

/**
 * Generate zip entries for bulk workspace export. One file per format per diagram;
 * mermaid is always included, whether or not the diagram has flows.
 */
export function buildWorkspaceExportFiles({
  services,
  ...planOptions
}: WorkspaceExportOptions): ZipEntryFile[] {
  return planWorkspaceExport(planOptions).map(({ diagram, format, filename }) => ({
    filename,
    content: buildExportContent(diagram, format, services),
  }));
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
    case "mermaid": {
      // A diagram without flows still gets a file carrying its name, so the zip has
      // one .md per diagram rather than a mix of real and empty files.
      const flows = exportMermaid(
        Object.values(diagram.snapshot.flows),
        diagram.snapshot.components,
        diagram.snapshot.connections,
      );
      return flows ? `# ${diagram.name}\n\n${flows}\n` : `# ${diagram.name}\n`;
    }
  }
}
