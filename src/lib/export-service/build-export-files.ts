import type { Diagram, Flow, ServiceDefinition } from "@/features/diagram";
import { exportFilenameSlug } from "@/features/diagram";
import { exportDrawio } from "./export-drawio";
import { exportJSON } from "./export-json";
import { exportMermaid } from "./export-mermaid";
import { exportSvg } from "./export-svg";
import { exportPng } from "./export-png";
import type { ReactFlowInstance } from "@xyflow/react";

export type DiagramExportFormat = "json" | "drawio" | "mermaid" | "svg" | "png";

export interface ExportArtifact {
  filename: string;
  content: string | Blob;
  mime: string;
}

interface BuildDiagramExportFilesArgs {
  diagram: Diagram;
  flows: Flow[];
  services: Record<string, ServiceDefinition>;
  formats: DiagramExportFormat[];
  /** Required when any visual format (svg, png) is requested. */
  reactFlowInstance?: ReactFlowInstance;
  framing?: "viewport" | "full";
}

const TEXT_FORMAT_EXTENSION: Record<Exclude<DiagramExportFormat, "svg" | "png">, string> = {
  json: "json",
  drawio: "drawio",
  mermaid: "md",
};

const TEXT_FORMAT_MIME: Record<Exclude<DiagramExportFormat, "svg" | "png">, string> = {
  json: "application/json",
  drawio: "application/xml",
  mermaid: "text/markdown",
};

const VISUAL_FORMAT_MIME: Record<"svg" | "png", string> = {
  svg: "image/svg+xml",
  png: "image/png",
};

const VISUAL_FORMAT_EXTENSION: Record<"svg" | "png", string> = {
  svg: "svg",
  png: "png",
};

export interface BuildDiagramExportFilesResult {
  baseName: string;
  files: ExportArtifact[];
  visualErrors: string[];
}

export async function buildDiagramExportFiles({
  diagram,
  flows,
  services,
  formats,
  reactFlowInstance,
  framing = "full",
}: BuildDiagramExportFilesArgs): Promise<BuildDiagramExportFilesResult> {
  const baseName = exportFilenameSlug(diagram);

  const textFormats = formats.filter(
    (f): f is Exclude<DiagramExportFormat, "svg" | "png"> =>
      f === "json" || f === "drawio" || f === "mermaid",
  );
  const visualFormats = formats.filter((f): f is "svg" | "png" => f === "svg" || f === "png");

  const textFiles = textFormats.map((format) => {
    const content = buildTextExport(format, diagram, flows, services);
    const suffix = format === "mermaid" ? "-flows" : "";

    return {
      filename: `${baseName}${suffix}.${TEXT_FORMAT_EXTENSION[format]}`,
      content,
      mime: TEXT_FORMAT_MIME[format],
    } as ExportArtifact;
  });

  const visualFiles: ExportArtifact[] = [];
  const visualErrors: string[] = [];

  if (visualFormats.length > 0 && !reactFlowInstance) {
    visualErrors.push("Canvas not ready — visual exports require the diagram to be fully loaded.");
  }

  for (const format of visualFormats) {
    if (!reactFlowInstance) continue;
    try {
      const content =
        format === "svg"
          ? await exportSvg(diagram, framing, reactFlowInstance)
          : await exportPng(diagram, framing, reactFlowInstance);

      visualFiles.push({
        filename: `${baseName}.${VISUAL_FORMAT_EXTENSION[format]}`,
        content,
        mime: VISUAL_FORMAT_MIME[format],
      });
    } catch (error) {
      const label = format.toUpperCase();
      const message = error instanceof Error ? error.message : "Unknown error";
      visualErrors.push(`${label} export failed: ${message}`);
    }
  }

  return {
    baseName,
    files: [...textFiles, ...visualFiles],
    visualErrors,
  };
}

function buildTextExport(
  format: Exclude<DiagramExportFormat, "svg" | "png">,
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
