import type { Diagram, DiagramModel, ServiceDefinition } from "@/features/diagram";
import { buildMxGraphXml } from "../export-core";
import { diagramToExportModel } from "./to-export-model";

export function extractMxGraphModelXml(fullDrawioFile: string): string {
  const m = fullDrawioFile.match(/<mxGraphModel\b[\s\S]*?<\/mxGraphModel>/);
  return m ? m[0] : fullDrawioFile;
}

export function exportDrawio(
  diagram: Diagram | DiagramModel,
  serviceCatalog: Record<string, ServiceDefinition>,
  options?: { componentIds?: string[] },
): string {
  const model = diagramToExportModel(diagram, serviceCatalog, options);
  return buildMxGraphXml(model, { wrapper: "mxfile" });
}
