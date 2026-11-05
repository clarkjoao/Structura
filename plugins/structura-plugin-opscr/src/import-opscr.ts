import { compileSources, Severity, type Diagnostic } from "opscr/core";
import {
  buildTechnicalView,
  isManifestName,
  placeView,
  toImporterGraph,
  toLayoutGraph,
  type PlacedView,
} from "./generated/opscr-mapping";
import type { ImportContext, ImportResult } from "./types/plugin.types";
import { layoutView } from "./generated/opscr-layout";

const OPSCR_API_VERSION = /^\s*apiVersion:\s*["']?opscr\.dev\//m;
/** opscr errors listed one by one before the rest are only counted. */
const MAX_LISTED_ERRORS = 10;

/** An `*.opscr.yaml` file, or any YAML whose content declares an opscr apiVersion. */
export function canImportOpscr(fileName: string, contents: string): boolean {
  return isManifestName(fileName) || OPSCR_API_VERSION.test(contents);
}

function describe(d: Diagnostic): string {
  const where = d.line !== undefined ? `line ${d.line}: ` : "";
  const field = d.fieldPath ? `${d.fieldPath} ` : "";
  return `opscr: ${where}${field}${d.message}`;
}

function warningsOf(diagnostics: readonly Diagnostic[], view: PlacedView): string[] {
  const errors = diagnostics.filter((d) => d.severity === Severity.ERROR);
  const warnings = errors.slice(0, MAX_LISTED_ERRORS).map(describe);
  if (errors.length > MAX_LISTED_ERRORS) {
    warnings.push(`opscr: ${errors.length - MAX_LISTED_ERRORS} more errors`);
  }
  if (view.omitted.length > 0) {
    const kinds = [...new Set(view.omitted.map((o) => o.kind))].sort().join(", ");
    warnings.push(`Not drawn in the technical view: ${view.omitted.length} (${kinds})`);
  }
  if (view.dropped.length > 0) {
    warnings.push(`Edges not drawn: ${view.dropped.length}`);
  }
  return warnings;
}

/** Parse, validate, project and lay out one opscr file. Never throws on bad input. */
export async function importOpscr(contents: string, ctx: ImportContext): Promise<ImportResult> {
  const { workspace, result } = await compileSources({
    files: [{ path: "import.opscr.yaml", content: contents }],
  });
  const view = buildTechnicalView(workspace);
  const placed = placeView(view, await layoutView(toLayoutGraph(view)));
  return {
    ...toImporterGraph(placed, ctx.anchor),
    warnings: warningsOf(result.diagnostics, placed),
  };
}
