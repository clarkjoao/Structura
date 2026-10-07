import { compileSources, type Diagnostic, type SourceFile } from "opscr/core";
import {
  buildTechnicalView,
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
}

export interface PreviewUpdate {
  /** Every opscr diagnostic for the workspace, for the Problems panel. */
  diagnostics: Diagnostic[];
  /** The picture to post; absent while the YAML does not parse (keep the last one). */
  graph?: ImporterGraph;
}

const PARSE_ERROR = "loader/yaml-parse-error";

/**
 * YAML text → the graph the preview draws, keeping the previous picture still: every
 * element that survives an edit keeps its place (`stabilizeLayout`). No VSCode API here, so
 * the whole path is unit-testable.
 */
export class PreviewPipeline {
  private previous: ViewLayoutResult | undefined;

  /** Forget the current picture: the next update lays everything out from scratch. */
  relayout(): void {
    this.previous = undefined;
  }

  async update(workspace: WorkspaceText): Promise<PreviewUpdate> {
    const { workspace: compiled, result } = await compileSources(workspace);
    const diagnostics = result.diagnostics;
    if (diagnostics.some((d) => d.ruleId === PARSE_ERROR)) return { diagnostics };

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
  return configText === undefined
    ? { files }
    : { files, config: { path: join(CONFIG_FILE), content: configText } };
}

export function isManifestPath(path: string): boolean {
  return MANIFEST.test(path) || path.endsWith(`/${CONFIG_FILE}`);
}
