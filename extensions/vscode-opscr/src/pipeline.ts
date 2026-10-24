import { dirname, join as joinPath } from "node:path";
import { compileSources, type Diagnostic, type SourceFile } from "opscr/core";
import {
  CONFIG_FILE,
  LAYOUT_FILE,
  SourceIndex,
  VISUAL_FILE,
  buildTechnicalView,
  isManifestName,
  overlayLayouts,
  parseLayoutFile,
  placeView,
  previousCoversView,
  stabilizeLayout,
  toImporterGraph,
  toLayoutGraph,
  parseVisualFile,
  withVisualLayer,
  type ImporterGraph,
  type ViewLayoutResult,
} from "./generated/opscr-mapping";
import { layoutView } from "./generated/opscr-layout";

/** opscr files of a workspace and its config, as text. */
export interface WorkspaceText {
  files: SourceFile[];
  config?: SourceFile;
  /** The folder's layout sidecar (`opscr.layout.json`) text, when there is one. */
  layout?: string;
  /** The visual layer of a workspace imported from draw.io (`opscr.visual.json`), when there is one. */
  visual?: string;
}

export interface PreviewUpdate {
  /** Every opscr diagnostic for the workspace, for the Problems panel. */
  diagnostics: Diagnostic[];
  /**
   * The picture to post; absent while the YAML does not parse or opscr reports errors (keep the
   * last one).
   */
  graph?: ImporterGraph;
  /** Where each element of `graph` is written, and which element a line writes. */
  sources?: SourceIndex;
  /** Why there is no picture: the YAML does not parse, or how many opscr errors it has. */
  blocked?: { reason: "parse" } | { reason: "errors"; errors: number };
}

const PARSE_ERROR = "loader/yaml-parse-error";

/**
 * YAML text → the graph the preview draws, keeping the previous picture still: every
 * element that survives an edit keeps its place (`stabilizeLayout`), new ones are laid out
 * next to their neighbours. Only YAML that opscr validates without errors is drawn — files here
 * change whole (Claude Code, git, a save), and a half-valid picture would mislead; warnings do
 * not block. No VSCode API here, so the whole path is unit-testable.
 */
export class PreviewPipeline {
  private previous: ViewLayoutResult | undefined;
  /** The sidecar text last applied, so an unchanged sidecar is not re-applied. */
  private sidecar: string | undefined;
  /** Updates run one at a time: each builds on the picture the one before left. */
  private queue: Promise<unknown> = Promise.resolve();

  /**
   * Forget the current picture: the next update lays everything out from scratch, ignoring
   * the sidecar until it changes.
   */
  relayout(): void {
    // After any update in flight, which would otherwise put its picture back.
    this.queue = this.queue.then(() => {
      this.previous = undefined;
    });
  }

  update(workspace: WorkspaceText): Promise<PreviewUpdate> {
    const next = this.queue.then(() => this.run(workspace));
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async run(workspace: WorkspaceText): Promise<PreviewUpdate> {
    if (workspace.layout !== undefined && workspace.layout !== this.sidecar) {
      // A new or changed sidecar (Structura saved it): its boxes win over the current picture.
      this.previous = overlayLayouts(this.previous, parseLayoutFile(workspace.layout));
    }
    this.sidecar = workspace.layout;
    const { files, config } = workspace;
    const { workspace: compiled, result } = await compileSources(
      config ? { files, config } : { files },
    );
    const diagnostics = result.diagnostics;
    if (diagnostics.some((d) => d.ruleId === PARSE_ERROR)) {
      return { diagnostics, blocked: { reason: "parse" } };
    }
    const errors = diagnostics.filter((d) => d.severity === "error").length;
    if (errors > 0) return { diagnostics, blocked: { reason: "errors", errors } };

    const view = buildTechnicalView(compiled);
    // An edit of text alone moves nothing: the layout engine would only be ignored.
    const fresh = previousCoversView(view, this.previous)
      ? { boxes: new Map(), edgeRoutes: new Map() }
      : await layoutView(toLayoutGraph(view), this.previous?.boxes);
    const stable = stabilizeLayout(view, fresh, this.previous);
    this.previous = stable;
    const graph = toImporterGraph(placeView(view, stable));
    // Boundaries, services with no Kind and text, drawn as the plugin draws them.
    const visual = workspace.visual ? parseVisualFile(workspace.visual) : null;
    return {
      diagnostics,
      graph: visual ? withVisualLayer(graph, visual).graph : graph,
      sources: new SourceIndex(compiled.manifests, view),
    };
  }
}

export { CONFIG_FILE };

/** Folders the workspace never reads manifests from. */
const SKIPPED_FOLDER = (segment: string) => segment === "node_modules" || segment.startsWith(".");

/**
 * The folder a manifest's workspace starts at — the one `opscr compile` would be given: the
 * nearest folder, from the file's own up to `stopAt` (the VSCode workspace folder), that holds
 * `opscr.config.yaml`, else the file's own folder. Everything below it is the workspace, so a
 * workspace may keep its views and model in subfolders.
 */
export async function workspaceRoot(
  file: string,
  hasConfig: (folder: string) => Promise<boolean>,
  stopAt?: string,
  parentOf: (path: string) => string = dirname,
): Promise<string> {
  const own = parentOf(file);
  for (let folder = own; ; folder = parentOf(folder)) {
    if (await hasConfig(folder)) return folder;
    if (folder === stopAt || parentOf(folder) === folder) return own;
  }
}

/**
 * The workspace of a folder: every opscr manifest below it (in subfolders too, but not under
 * `node_modules` or a dot folder) plus the folder's own `opscr.config.yaml`, layout and visual
 * sidecars, read through `readText` — which the extension answers from an open editor's unsaved
 * text when there is one, and from disk otherwise. `fileNames` are paths relative to `folder`,
 * with `/` or the platform's separator.
 */
export async function collectWorkspace(
  folder: string,
  fileNames: readonly string[],
  readText: (path: string) => Promise<string | undefined>,
  /** The platform's path join; another platform's in tests. */
  platformJoin: (...parts: string[]) => string = joinPath,
): Promise<WorkspaceText> {
  // The platform's separator: these paths are compared with VSCode's `fsPath` (the cursor's
  // file, the Problems panel's), which uses backslashes on Windows.
  const segmentsOf = (name: string) => name.split(/[\\/]/);
  const join = (name: string) => platformJoin(folder, ...segmentsOf(name));
  const wanted = [...fileNames]
    .filter(isManifestName)
    .filter((name) => !segmentsOf(name).slice(0, -1).some(SKIPPED_FOLDER))
    .sort((a, b) => segmentsOf(a).join("/").localeCompare(segmentsOf(b).join("/")));
  const files: SourceFile[] = [];
  for (const name of wanted) {
    const content = await readText(join(name));
    if (content !== undefined) files.push({ path: join(name), content });
  }
  const configText = fileNames.includes(CONFIG_FILE)
    ? await readText(join(CONFIG_FILE))
    : undefined;
  const layout = fileNames.includes(LAYOUT_FILE) ? await readText(join(LAYOUT_FILE)) : undefined;
  const visual = fileNames.includes(VISUAL_FILE) ? await readText(join(VISUAL_FILE)) : undefined;
  return {
    files,
    ...(configText === undefined
      ? {}
      : { config: { path: join(CONFIG_FILE), content: configText } }),
    ...(layout === undefined ? {} : { layout }),
    ...(visual === undefined ? {} : { visual }),
  };
}

export function isManifestPath(path: string): boolean {
  return (
    isManifestName(path) ||
    path.endsWith(`/${CONFIG_FILE}`) ||
    path.endsWith(`\\${CONFIG_FILE}`) ||
    path.endsWith(`/${LAYOUT_FILE}`) ||
    path.endsWith(`/${VISUAL_FILE}`)
  );
}
