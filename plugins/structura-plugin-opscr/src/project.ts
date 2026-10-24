import { compileSources, resolveView, type Diagnostic, type SourceFile } from "opscr/core";
import {
  CONFIG_FILE,
  SourceIndex,
  buildTechnicalView,
  buildViewDiagram,
  isManifestName,
  placeView,
  previousCoversView,
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
  // An edit of text alone moves nothing: the layout engine would only be ignored.
  const fresh = previousCoversView(view, seeded)
    ? { boxes: new Map(), edgeRoutes: new Map() }
    : await layoutView(toLayoutGraph(view), seeded?.boxes);
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

export interface ViewProjection {
  diagnostics: Diagnostic[];
  /** The Views the workspace declares, by name; empty for a workspace with none. */
  views: string[];
  /** The named View laid out, absent while it does not resolve (unknown name, YAML errors). */
  graph?: ImporterGraph;
}

/**
 * One opscr View as the graph its diagram should show. opscr chooses and lifts what the view
 * contains (`resolveView`); Structura only lays it out — seeded by `previous` (the canvas, or
 * the sidecar's boxes for this view) so what the reader placed stays where it is. Never throws.
 */
export async function projectView(
  files: SourceFile[],
  config: SourceFile | undefined,
  viewName: string,
  previous?: ViewLayoutResult,
): Promise<ViewProjection> {
  const { workspace, result } = await compileSources(config ? { files, config } : { files });
  const views = workspace.getByKind("View").map((v) => v.metadata.name);
  if (result.diagnostics.some((d) => d.ruleId === "loader/yaml-parse-error")) {
    return { diagnostics: result.diagnostics, views };
  }
  const resolved = resolveView(workspace, viewName);
  if (!resolved) return { diagnostics: result.diagnostics, views };
  const view = buildViewDiagram(workspace, resolved);
  const seeded = previous && previous.boxes.size > 0 ? previous : undefined;
  const fresh = previousCoversView(view, seeded)
    ? { boxes: new Map(), edgeRoutes: new Map() }
    : await layoutView(toLayoutGraph(view), seeded?.boxes);
  const stable = stabilizeLayout(view, fresh, seeded);
  return {
    diagnostics: result.diagnostics,
    views,
    graph: toImporterGraph(placeView(view, stable), seeded ? { x: 0, y: 0 } : ORIGIN),
  };
}

/** `projectWorkspace` as the engine calls it (file name + text). */
export const projector = ((manifests, config, previous) =>
  projectWorkspace(
    manifests.map((f) => ({ path: f.name, content: f.text })),
    config ? { path: config.name, content: config.text } : undefined,
    previous,
  )) satisfies Projector;
