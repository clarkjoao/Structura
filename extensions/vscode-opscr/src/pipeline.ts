import { dirname, join as joinPath } from "node:path";
import {
  DEFAULT_INITIATIVES_DIR,
  WORKSPACE_FILE,
  compileSources,
  parseWorkspaceFile,
  resolveView,
  type Diagnostic,
  type SourceFile,
} from "opscr/core";
import {
  CONFIG_FILE,
  LAYOUT_FILE,
  SourceIndex,
  VISUAL_FILE,
  buildTechnicalView,
  buildViewDiagram,
  isManifestName,
  overlayLayouts,
  parseLayoutFiles,
  placeView,
  previousCoversView,
  stabilizeLayout,
  toImporterGraph,
  toLayoutGraph,
  parseVisualFile,
  withVisualLayer,
  withoutBroken,
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
  /** The Views the workspace declares, by name (empty when it has none). */
  views?: string[];
  /** The View drawn; undefined when the whole workspace is. */
  view?: string;
  /** Boxes of the drawn view that open another view: component key → View name. */
  links?: Map<string, string>;
  /** `Kind/name` of the elements left out of the picture for an opscr error in them. */
  broken?: string[];
  /** Why there is no picture: the YAML does not parse. */
  blocked?: { reason: "parse" };
}

const PARSE_ERROR = "loader/yaml-parse-error";

/**
 * YAML text → the graph the preview draws, keeping the previous picture still: every
 * element that survives an edit keeps its place (`stabilizeLayout`), new ones are laid out
 * next to their neighbours. An element opscr reports an error in is left out (`withoutBroken`) and
 * the rest is drawn — one manifest written without a required field (by hand, or from a canvas)
 * must not freeze the preview; the errors stay in the Problems panel. Only YAML that does not
 * parse keeps the last picture. No VSCode API here, so the whole path is unit-testable.
 */
export class PreviewPipeline {
  /** The picture on screen, per diagram: the whole workspace's ("") and each View's. */
  private readonly pictures = new Map<string, ViewLayoutResult>();
  /** The sidecar text last applied, so an unchanged sidecar is not re-applied. */
  private sidecar: string | undefined;
  /** Updates run one at a time: each builds on the picture the one before left. */
  private queue: Promise<unknown> = Promise.resolve();

  /**
   * Forget the current picture: the next update lays everything out from scratch, ignoring
   * the sidecar until it changes.
   */
  relayout(view?: string): void {
    // After any update in flight, which would otherwise put its picture back.
    this.queue = this.queue.then(() => {
      this.pictures.delete(view ?? "");
    });
  }

  /** `view`: the opscr View to draw; undefined draws the whole workspace. */
  update(workspace: WorkspaceText, view?: string): Promise<PreviewUpdate> {
    const next = this.queue.then(() => this.run(workspace, view));
    this.queue = next.catch(() => undefined);
    return next;
  }

  private async run(workspace: WorkspaceText, wanted?: string): Promise<PreviewUpdate> {
    if (workspace.layout !== undefined && workspace.layout !== this.sidecar) {
      // A new or changed sidecar (Structura saved it): its boxes win over the current pictures.
      const files = parseLayoutFiles(workspace.layout);
      for (const key of new Set(["", ...this.pictures.keys(), ...(files?.views.keys() ?? [])])) {
        const sidecarBoxes = key === "" ? files?.base : files?.views.get(key);
        const merged = overlayLayouts(this.pictures.get(key), sidecarBoxes);
        if (merged) this.pictures.set(key, merged);
      }
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
    const { manifests, broken } = withoutBroken(compiled.manifests, diagnostics);
    const drawable = { manifests };

    const views = compiled.getByKind("View").map((v) => v.metadata.name);
    // A View that is gone (renamed, deleted) falls back to the whole workspace.
    const resolved =
      wanted !== undefined && views.includes(wanted) ? resolveView(compiled, wanted) : undefined;
    const drawn = resolved ? wanted : undefined;
    const view = resolved ? buildViewDiagram(drawable, resolved) : buildTechnicalView(drawable);
    const key = drawn ?? "";
    const previous = this.pictures.get(key);
    // An edit of text alone moves nothing: the layout engine would only be ignored.
    const fresh = previousCoversView(view, previous)
      ? { boxes: new Map(), edgeRoutes: new Map() }
      : await layoutView(toLayoutGraph(view), previous?.boxes);
    const stable = stabilizeLayout(view, fresh, previous);
    this.pictures.set(key, stable);
    const graph = toImporterGraph(placeView(view, stable));
    const links = new Map(
      graph.components.flatMap((c) =>
        c.linkedView !== undefined ? [[c.key, c.linkedView] as const] : [],
      ),
    );
    // Boundaries, services with no Kind and text, drawn as the plugin draws them — in the
    // whole-workspace picture only: a View is a projection of the manifests.
    const visual = !drawn && workspace.visual ? parseVisualFile(workspace.visual) : null;
    return {
      diagnostics,
      graph: visual ? withVisualLayer(graph, visual).graph : graph,
      sources: new SourceIndex(manifests, view),
      views,
      ...(drawn !== undefined ? { view: drawn } : {}),
      links,
      ...(broken.length > 0 ? { broken } : {}),
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
    const stop =
      folder === probe.stopAt || above === folder || (!probe.stopAt && level >= MAX_LEVELS_UP);
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
  // A product workspace (`opscr.workspace.yaml`): the root is the AS-IS and each initiative
  // folder an overlay on it, so the initiatives are not part of the picture drawn here.
  const workspaceText = fileNames.includes(WORKSPACE_FILE)
    ? await readText(join(WORKSPACE_FILE))
    : undefined;
  const initiatives =
    workspaceText === undefined
      ? undefined
      : (parseWorkspaceFile(workspaceText, WORKSPACE_FILE).workspace?.initiatives ??
        DEFAULT_INITIATIVES_DIR);
  const inInitiatives = (name: string) =>
    initiatives !== undefined && segmentsOf(name).join("/").startsWith(`${initiatives}/`);
  const wanted = [...fileNames]
    .filter(isManifestName)
    .filter((name) => !segmentsOf(name).slice(0, -1).some(SKIPPED_FOLDER))
    .filter((name) => !inInitiatives(name))
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
    path.endsWith(`/${WORKSPACE_FILE}`) ||
    path.endsWith(`\\${WORKSPACE_FILE}`) ||
    path.endsWith(`/${CONFIG_FILE}`) ||
    path.endsWith(`\\${CONFIG_FILE}`) ||
    path.endsWith(`/${LAYOUT_FILE}`) ||
    path.endsWith(`/${VISUAL_FILE}`)
  );
}
