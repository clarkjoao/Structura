import { downloadFile } from "@/lib/export-service/download-file";
import type { DiagramIR } from "./ir.types";

/**
 * Exporting the IR of a real generation.
 *
 * The reference diagrams used to measure layout readability had to be written
 * by hand, because the IR of the generations that were reviewed was never kept.
 * Saving one to disk turns any future generation into a fixture, so the numbers
 * can be based on what the model actually produced.
 */

export function buildIRFilename(ir: DiagramIR, now: Date = new Date()): string {
  const stamp = now.toISOString().replace(/[:.]/g, "-").slice(0, 19);
  return `structura-ir-${ir.type}-${stamp}.json`;
}

export function serializeIR(ir: DiagramIR): string {
  return `${JSON.stringify(ir, null, 2)}\n`;
}

/** Downloads the IR as a JSON file. Returns the filename it used. */
export function downloadIR(ir: DiagramIR, now: Date = new Date()): string {
  const filename = buildIRFilename(ir, now);
  downloadFile(serializeIR(ir), filename, "application/json");
  return filename;
}
