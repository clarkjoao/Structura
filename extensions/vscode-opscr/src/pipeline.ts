import { compileSources, type Diagnostic, type SourceFile } from "opscr/core";
import {
  LAYOUT_FILE,
  buildTechnicalView,
  overlayLayouts,
  parseLayoutFile,
  placeView,
  stabilizeLayout,
  toImporterGraph,
  toLayoutGraph,
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
}

export interface PreviewUpdate {
  /** Every opscr diagnostic for the workspace, for the Problems panel. */
  diagnostics: Diagnostic[];
  /**
   * The picture to post; absent while the YAML does not parse or opscr reports errors (keep the
   * last one).
   */
  graph?: ImporterGraph;
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

  /**
   * Forget the current picture: the next update lays everything out from scratch, ignoring
   * the sidecar until it changes.
   */
  relayout(): void {
    this.previous = undefined;
  }

  async update(workspace: WorkspaceText): Promise<PreviewUpdate> {
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
    const fresh = await layoutView(toLayoutGraph(view), this.previous?.boxes);
    const stable = stabilizeLayout(view, fresh, this.previous);
    this.previous = stable;
    return { diagnostics, graph: toImporterGraph(placeView(view, stable)) };
  }
}

const MANIFEST = /\.opscr\.ya?ml$/i;
export const CONFIG_FILE = "opscr.config.yaml";

/**
 * The workspace a file belongs to: every opscr manifest in its folder plus the folder's
 * `opscr.config.yaml`, read through `readText` — which the extension answers from an open
 * editor's unsaved text when there is one, and from disk otherwise.
 */
export async function collectWorkspace(
  folder: string,
  fileNames: readonly string[],
  readText: (path: string) => Promise<string | undefined>,
): Promise<WorkspaceText> {
  const join = (name: string) => `${folder.replace(/\/$/, "")}/${name}`;
  const files: SourceFile[] = [];
  for (const name of [...fileNames].filter((n) => MANIFEST.test(n)).sort()) {
    const content = await readText(join(name));
    if (content !== undefined) files.push({ path: join(name), content });
  }
  const configText = fileNames.includes(CONFIG_FILE)
    ? await readText(join(CONFIG_FILE))
    : undefined;
  const layout = fileNames.includes(LAYOUT_FILE) ? await readText(join(LAYOUT_FILE)) : undefined;
  return {
    files,
    ...(configText === undefined
      ? {}
      : { config: { path: join(CONFIG_FILE), content: configText } }),
    ...(layout === undefined ? {} : { layout }),
  };
}

export function isManifestPath(path: string): boolean {
  return (
    MANIFEST.test(path) || path.endsWith(`/${CONFIG_FILE}`) || path.endsWith(`/${LAYOUT_FILE}`)
  );
}
