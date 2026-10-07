import { compileSources, Severity, type Diagnostic } from "opscr/core";
import {
  buildTechnicalView,
  placeView,
  toLayoutGraph,
  type PlacedView,
} from "./generated/opscr-mapping";
import type { ImportContext, ImportResult, PluginComponentInput } from "./types/plugin.types";
import { layoutView } from "./elk-layout";

const OPSCR_FILE = /\.opscr\.ya?ml$/i;
const OPSCR_API_VERSION = /^\s*apiVersion:\s*["']?opscr\.dev\//m;
/** opscr errors listed one by one before the rest are only counted. */
const MAX_LISTED_ERRORS = 10;

/** An `*.opscr.yaml` file, or any YAML whose content declares an opscr apiVersion. */
export function canImportOpscr(fileName: string, contents: string): boolean {
  return OPSCR_FILE.test(fileName) || OPSCR_API_VERSION.test(contents);
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

/** The placed view as importer data: roots at the anchor, children relative to their panel. */
export function toImportResult(
  view: PlacedView,
  anchor: ImportContext["anchor"],
): Omit<ImportResult, "warnings"> {
  const components = view.nodes.map((node): PluginComponentInput => {
    const isRoot = node.parentId === null;
    const { type, catalogServiceId, technology } = node.element;
    return {
      key: node.id,
      name: node.name,
      type,
      description: node.description,
      ...(node.parentId !== null ? { parentKey: node.parentId } : {}),
      ...(catalogServiceId !== undefined ? { cloudServiceId: catalogServiceId } : {}),
      ...(technology !== undefined ? { technology } : {}),
      x: node.box.x + (isRoot ? anchor.x : 0),
      y: node.box.y + (isRoot ? anchor.y : 0),
      // Panels take the size that holds their children; leaves keep their intrinsic size.
      ...(node.isBoundary ? { width: node.box.width, height: node.box.height } : {}),
    };
  });
  const connections = view.edges.map((edge) => ({
    source: edge.sourceId,
    target: edge.targetId,
    label: edge.type,
  }));
  return { components, connections };
}

/** Parse, validate, project and lay out one opscr file. Never throws on bad input. */
export async function importOpscr(contents: string, ctx: ImportContext): Promise<ImportResult> {
  const { workspace, result } = await compileSources({
    files: [{ path: "import.opscr.yaml", content: contents }],
  });
  const view = buildTechnicalView(workspace);
  const placed = placeView(view, await layoutView(toLayoutGraph(view)));
  return {
    ...toImportResult(placed, ctx.anchor),
    warnings: warningsOf(result.diagnostics, placed),
  };
}
