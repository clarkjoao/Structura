import type { Diagram, Flow, ServiceDefinition } from "@/features/diagram";
import { exportFilenameSlug } from "@/features/diagram";
import { exportDrawio } from "./export-drawio";
import { exportJSON } from "./export-json";
import { exportMermaid } from "./export-mermaid";

export type DiagramExportFormat = "json" | "drawio" | "mermaid";

export interface ExportArtifact {
  filename: string;
  content: string;
  mime: string;
}

interface BuildDiagramExportFilesArgs {
  diagram: Diagram;
  flows: Flow[];
  services: Record<string, ServiceDefinition>;
  formats: DiagramExportFormat[];
}

const FORMAT_EXTENSION: Record<DiagramExportFormat, string> = {
  json: "json",
  drawio: "drawio",
  mermaid: "md",
};

const FORMAT_MIME: Record<DiagramExportFormat, string> = {
  json: "application/json",
  drawio: "application/xml",
  mermaid: "text/markdown",
};

export function buildDiagramExportFiles({
  diagram,
  flows,
  services,
  formats,
}: BuildDiagramExportFilesArgs): { baseName: string; files: ExportArtifact[] } {
  const baseName = exportFilenameSlug(diagram);
  const files = formats.map((format) => {
    const content = buildExportContent(format, diagram, flows, services);
    const suffix = format === "mermaid" ? "-flows" : "";

    return {
      filename: `${baseName}${suffix}.${FORMAT_EXTENSION[format]}`,
      content,
      mime: FORMAT_MIME[format],
    };
  });

  return { baseName, files };
}

function buildExportContent(
  format: DiagramExportFormat,
  diagram: Diagram,
  flows: Flow[],
  services: Record<string, ServiceDefinition>,
): string {
  switch (format) {
    case "json":
      return exportJSON(diagram, services);
    case "drawio":
      return exportDrawio(diagram, services);
    case "mermaid":
      // Flows are defined against the trunk snapshot; scene-filtered graphs can omit
      // connections still referenced by flow steps, which would yield an empty diagram.
      return exportMermaid(flows, diagram.snapshot.components, diagram.snapshot.connections);
  }
}
