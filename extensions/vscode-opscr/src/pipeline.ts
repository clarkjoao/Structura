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

/** What a reference that points at nothing is reported as: the sign a file's workspace is wider. */
const DANGLING_RULES = new Set([
  "relationship/components-exist",
  "references/missing-target",
  "references/kind-mismatch",
  "views/reference",
  "views/drilldown-target",
  "structure/component-parent",
]);

/** How many folders above the file are tried when the editor has no workspace folder to stop at. */
const MAX_LEVELS_UP = 4;

export interface WorkspaceProbe {
  hasConfig(folder: string): Promise<boolean>;
  /**
   * The workspace files below a folder as relative paths (manifests and sidecars), or undefined
   * when the folder is too big to read — a repository root, say.
   */
  list(folder: string): Promise<string[] | undefined>;
  read(path: string): Promise<string | undefined>;
  /** The editor's workspace folder: the search for a wider workspace goes no higher. */
  stopAt?: string;
  parentOf?: (path: string) => string;
  platformJoin?: (...parts: string[]) => string;
}

/**
 * The folder whose workspace a manifest belongs to, found from the file alone.
 *
 * With an `opscr.config.yaml` above it, that folder (see `workspaceRoot`). Without one, the
 * smallest folder from the file's own upward whose manifests leave no reference pointing at
 * nothing — a view in `shop/views/` names elements in `shop/model/`, so `views/` alone has
 * dangling references and `shop/` has none. When no folder is clean (a real typo), the one with
 * the fewest, the lowest on a tie. A sibling solution does not matter: the climb stops at the
 * first folder that holds everything the file refers to.
 */
export async function detectWorkspaceRoot(file: string, probe: WorkspaceProbe): Promise<string> {
  const parentOf = probe.parentOf ?? dirname;
  const own = parentOf(file);
  const configured = await workspaceRoot(file, probe.hasConfig, probe.stopAt, parentOf);
  if (configured !== own || (await probe.hasConfig(own))) return configured;

  const dangling = async (folder: string): Promise<number | undefined> => {
    const names = await probe.list(folder);
    if (!names) return undefined;
    const workspace = await collectWorkspace(folder, names, probe.read, probe.platformJoin);
    const { files, config } = workspace;
    const { result } = await compileSources(config ? { files, config } : { files });
    return result.diagnostics.filter((d) => d.ruleId && DANGLING_RULES.has(d.ruleId)).length;
  };

  let best: { folder: string; count: number } | undefined;
  let folder = own;
  for (let level = 0; ; level++) {
    const count = await dangling(folder);
    if (count === undefined) break;
    if (count === 0) return folder;
    if (!best || count < best.count) best = { folder, count };
    const above = parentOf(folder);
    const stop = folder === probe.stopAt || above === folder || (!probe.stopAt && level >= MAX_LEVELS_UP);
    if (stop) break;
    folder = above;
  }
  return best?.folder ?? own;
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
