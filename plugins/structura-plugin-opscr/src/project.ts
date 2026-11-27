import { compileSources, resolveView, type Diagnostic, type SourceFile } from "opscr/core";
import {
  CONFIG_FILE,
  SourceIndex,
  buildTechnicalView,
  buildViewDiagram,
  isManifestName,
  placeView,
  toImporterGraph,
  type DroppedEdge,
  type ImporterGraph,
  type OmittedManifest,
  type ViewLayoutResult,
} from "./opscr-mapping";
import { placeWorkspaceView } from "./layout";
import type { Projector, ViewInfo } from "./engine/engine";

export interface Projection {
  diagnostics: Diagnostic[];
  /** Absent while the YAML does not parse: the diagram stays as it is. */
  graph?: ImporterGraph;
  /** Where each element of `graph` is written (file names as given), with `graph`. */
  sources?: SourceIndex;
  /** Manifests of Kinds the diagram does not draw, and edges it cannot draw, with `graph`. */
  omitted?: OmittedManifest[];
  dropped?: DroppedEdge[];
  /** The Views the workspace declares, by name. */
  views?: string[];
  viewInfos?: ViewInfo[];
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
  /** The diagram it is for: its reading direction and Arrange settings. */
  diagramId?: string,
): Promise<Projection> {
  const { workspace, result } = await compileSources(config ? { files, config } : { files });
  if (result.diagnostics.some((d) => d.ruleId === "loader/yaml-parse-error")) {
    return { diagnostics: result.diagnostics };
  }
  const view = buildTechnicalView(workspace);
  const viewInfos = viewInfosOf(workspace);
  const views = viewInfos.map((v) => v.name);
  const seeded = previous && previous.boxes.size > 0 ? previous : undefined;
  // Structura places it: an edit of text alone moves nothing, a new element goes beside what it
  // is connected to.
  const stable = await placeWorkspaceView(view, seeded, diagramId);
  // A first sync is anchored at ORIGIN; later ones keep the canvas's own coordinates.
  return {
    diagnostics: result.diagnostics,
    graph: toImporterGraph(placeView(view, stable), seeded ? { x: 0, y: 0 } : ORIGIN),
    sources: new SourceIndex(workspace.manifests, view),
    omitted: view.omitted,
    dropped: view.dropped,
    views,
    viewInfos,
  };
}

/** The Views of a compiled workspace, in name order. */
function viewInfosOf(workspace: {
  getByKind(kind: string): Array<{ metadata: { name: string }; spec: Record<string, unknown> }>;
}): ViewInfo[] {
  const text = (v: unknown) => (typeof v === "string" && v.trim() !== "" ? v : undefined);
  return workspace
    .getByKind("View")
    .map((v): ViewInfo => {
      const title = text(v.spec["title"]);
      const description = text(v.spec["description"]);
      return {
        name: v.metadata.name,
        type: String(v.spec["type"] ?? ""),
        ...(title ? { title } : {}),
        ...(description ? { description } : {}),
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name));
}

export interface ViewProjection {
  diagnostics: Diagnostic[];
  /** The Views the workspace declares, by name; empty for a workspace with none. */
  views: string[];
  viewInfos: ViewInfo[];
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
  diagramId?: string,
): Promise<ViewProjection> {
  const { workspace, result } = await compileSources(config ? { files, config } : { files });
  const viewInfos = viewInfosOf(workspace);
  const views = viewInfos.map((v) => v.name);
  if (result.diagnostics.some((d) => d.ruleId === "loader/yaml-parse-error")) {
    return { diagnostics: result.diagnostics, views, viewInfos };
  }
  const resolved = resolveView(workspace, viewName);
  if (!resolved) return { diagnostics: result.diagnostics, views, viewInfos };
  const view = buildViewDiagram(workspace, resolved);
  const seeded = previous && previous.boxes.size > 0 ? previous : undefined;
  const stable = await placeWorkspaceView(view, seeded, diagramId);
  return {
    diagnostics: result.diagnostics,
    views,
    viewInfos,
    graph: toImporterGraph(placeView(view, stable), seeded ? { x: 0, y: 0 } : ORIGIN),
  };
}

/** `projectWorkspace`, or `projectView` when a View is asked for, as the engine calls it (file name + text). */
export const projector = (async (manifests, config, previous, view, diagramId) => {
  const files = manifests.map((f) => ({ path: f.name, content: f.text }));
  const configFile = config ? { path: config.name, content: config.text } : undefined;
  if (view === undefined) return projectWorkspace(files, configFile, previous, diagramId);
  const projected = await projectView(files, configFile, view, previous, diagramId);
  // Edits are a no-op in a View, so the source index and the dropped lists stay empty.
  return { ...projected, views: projected.views };
}) satisfies Projector;
