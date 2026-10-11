import { compileSources, type Diagnostic, type SourceFile } from "opscr/core";
import {
  CONFIG_FILE,
  SourceIndex,
  buildTechnicalView,
  isManifestName,
  placeView,
  stabilizeLayout,
  toImporterGraph,
  toLayoutGraph,
  type DroppedEdge,
  type ImporterGraph,
  type OmittedManifest,
  type ViewLayoutResult,
} from "./generated/opscr-mapping";
import { layoutView } from "./generated/opscr-layout";
import type { Projector } from "./engine/engine";

export interface Projection {
  diagnostics: Diagnostic[];
  /** Absent while the YAML does not parse: the diagram stays as it is. */
  graph?: ImporterGraph;
  /** Where each element of `graph` is written (file names as given), with `graph`. */
  sources?: SourceIndex;
  /** Manifests of Kinds the diagram does not draw, and edges it cannot draw, with `graph`. */
  omitted?: OmittedManifest[];
  dropped?: DroppedEdge[];
}

export { CONFIG_FILE };
export const isManifest = isManifestName;

/** Where a first sync puts the diagram's top-left corner. */
const ORIGIN = { x: 40, y: 40 };

/**
 * The workspace's YAML → the graph the bound diagram should show. `previous` is what the
 * canvas shows now (by element key); surviving elements keep those boxes.
 */
export async function projectWorkspace(
  files: SourceFile[],
  config: SourceFile | undefined,
  previous: ViewLayoutResult | undefined,
): Promise<Projection> {
  const { workspace, result } = await compileSources(config ? { files, config } : { files });
  if (result.diagnostics.some((d) => d.ruleId === "loader/yaml-parse-error")) {
    return { diagnostics: result.diagnostics };
  }
  const view = buildTechnicalView(workspace);
  const seeded = previous && previous.boxes.size > 0 ? previous : undefined;
  const fresh = await layoutView(toLayoutGraph(view), seeded?.boxes);
  const stable = stabilizeLayout(view, fresh, seeded);
  // A first sync is anchored at ORIGIN; later ones keep the canvas's own coordinates.
  return {
    diagnostics: result.diagnostics,
    graph: toImporterGraph(placeView(view, stable), seeded ? { x: 0, y: 0 } : ORIGIN),
    sources: new SourceIndex(workspace.manifests, view),
    omitted: view.omitted,
    dropped: view.dropped,
  };
}

/** `projectWorkspace` as the engine calls it (file name + text). */
export const projector = ((manifests, config, previous) =>
  projectWorkspace(
    manifests.map((f) => ({ path: f.name, content: f.text })),
    config ? { path: config.name, content: config.text } : undefined,
    previous,
  )) satisfies Projector;
