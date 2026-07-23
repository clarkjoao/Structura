/**
 * Export Draw.io Module (LeanIX)
 *
 * Converts a plugin DiagramSnapshot to draw.io XML via the shared export core.
 * LeanIX expects ONLY <mxGraphModel>, not the <mxfile> wrapper.
 */

import type { DiagramSnapshot } from "../../types/plugin.types";
import { buildMxGraphXml } from "../../generated/export-core";
import { snapshotToExportModel } from "./to-export-model";

/** Extract mxGraphModel from a full draw.io file. */
export function extractMxGraphModelXml(fullDrawioFile: string): string {
  const m = fullDrawioFile.match(/<mxGraphModel\b[\s\S]*?<\/mxGraphModel>/);
  return m ? m[0] : fullDrawioFile;
}

export function exportDrawio(
  diagram: DiagramSnapshot,
  options?: { componentIds?: string[] },
): string {
  if (!diagram.components || !diagram.connections) {
    throw new Error("Invalid diagram snapshot structure");
  }
  const model = snapshotToExportModel(diagram, options);
  return buildMxGraphXml(model, { wrapper: "mxgraphModel" });
}
