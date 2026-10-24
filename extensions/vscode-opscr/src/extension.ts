/**
 * opscr Preview — a live, read-only Structura diagram of the opscr workspace of the active
 * `*.opscr.yaml`. The extension host validates the YAML with opscr and turns it into a graph
 * (the technical view, ELK, stable placement); the webview is Structura's embed preview, which
 * draws it. The YAML is edited in VSCode — by the user or Claude Code — never from the diagram.
 * The two point at each other: a click on an element opens the YAML that writes it, and the
 * element the cursor is in is lit in the preview.
 */
import { readFile, readdir } from "node:fs/promises";
import { basename, join as joinPath, sep } from "node:path";
import * as vscode from "vscode";
import type { Diagnostic as OpscrDiagnostic } from "opscr/core";
import type { GraphElementRef, SourceIndex, SourceLocation } from "./generated/opscr-mapping";
import { collectWorkspace, isManifestPath, PreviewPipeline, workspaceRoot } from "./pipeline";
import { previewHtml } from "./webview-html";

const UPDATE_DELAY_MS = 300;
/** How long a probe waits for the webview's answer before answering "nothing seen". */
const PROBE_TIMEOUT_MS = 2000;
/** A probe's answer when the webview cannot answer — not loaded yet, reloading or closed. */
const PROBE_UNANSWERED = {
  type: "STRUCTURA_PROBE_RESULT",
  viewport: "",
  searchOpen: false,
  visible: false,
  blocked: false,
  selected: [],
} as const;

/** What the webview sends: see the protocol in the host's `src/embed/protocol.ts`. */
interface WebviewMessage {
  type?: string;
  nodes?: number;
  element?: GraphElementRef;
  index?: number;
}

class Preview {
  private readonly pipeline = new PreviewPipeline();
  private timer: NodeJS.Timeout | undefined;
  private ready = false;
  private rendered = 0;
  private lastGraph: { components: unknown[] } | undefined;
  private readonly probes: Array<(result: unknown) => void> = [];
  /** The last STRUCTURA_BLOCKED sent, re-sent when the webview reloads; null while drawing. */
  private lastBlocked: object | null = null;
  /** Opscr errors keeping the last picture on screen (0 while it follows the YAML). */
  private blocked = 0;
  /** Says why the preview is not following the YAML, while it is not. */
  private readonly statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  /** Files this preview put in the Problems panel, cleared when they leave the workspace. */
  private published = new Set<string>();
  /** Monotonic: an update that finishes after a newer one started is dropped. */
  private generation = 0;
  /** Where the drawn elements are written — from the YAML of the picture on screen. */
  private sources: SourceIndex | undefined;
  /** The element last lit or clicked, so the cursor moving inside it posts nothing. */
  private selected: GraphElementRef | null = null;
  /** Where each problem listed in the preview is, by its place in the list. */
  private problemLocations: Array<SourceLocation | null> = [];

  constructor(
    readonly folder: string,
    private readonly panel: vscode.WebviewPanel,
    private readonly diagnostics: vscode.DiagnosticCollection,
  ) {
    panel.webview.onDidReceiveMessage((message: WebviewMessage) =>
      // Opening a file can fail (deleted meanwhile): nothing to do but say so in the log.
      this.receive(message).catch((error: unknown) => console.error("[opscr] preview:", error)),
    );
  }

  /** A message from the webview (or, for the end-to-end test, one posed as it). */
  async receive(message: WebviewMessage): Promise<void> {
    if (message?.type === "STRUCTURA_RENDERED") this.rendered = message.nodes ?? 0;
    if (message?.type === "STRUCTURA_PROBE_RESULT") {
      for (const resolve of this.probes.splice(0)) resolve(message);
    }
    if (message?.type === "STRUCTURA_REVEAL" && message.element) {
      const at = this.sources?.locate(message.element);
      if (!at) return;
      // The cursor lands in the element: that must not light it again.
      this.selected = message.element;
      await showSource(at);
    }
    if (message?.type === "STRUCTURA_OPEN_PROBLEM" && typeof message.index === "number") {
      const at = this.problemLocations[message.index];
      if (at) await showSource(at);
      else await vscode.commands.executeCommand("workbench.actions.view.problems");
    }
    if (message?.type !== "STRUCTURA_READY") return;
    this.ready = true;
    this.postTheme();
    if (this.lastGraph) this.post({ type: "STRUCTURA_LOAD_GRAPH", ...this.lastGraph });
    if (this.lastBlocked) this.post(this.lastBlocked);
    if (this.selected) this.post({ type: "STRUCTURA_SELECT", element: this.selected });
  }

  /**
   * The cursor is on `line` (1-based) of `file`: light the element written there. Not while the
   * picture is held back by errors — its lines are not the ones in the editor.
   */
  cursorAt(file: string, line: number): void {
    if (!this.sources || this.blocked) return;
    const element = this.sources.elementAt(file, line);
    if (sameElement(element, this.selected)) return;
    this.selected = element;
    this.post({ type: "STRUCTURA_SELECT", element });
  }

  schedule(): void {
    clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.update(), UPDATE_DELAY_MS);
  }

  relayout(): void {
    this.pipeline.relayout();
    void this.update();
  }

  isActive(): boolean {
    return this.panel.active;
  }

  /**
   * For the end-to-end test: where the canvas looks and whether the search is open. Always
   * settles — with PROBE_UNANSWERED when the webview is not there to answer — so a test waiting
   * on it reaches its own timeout instead of hanging.
   */
  probe(): Promise<unknown> {
    if (!this.ready) return Promise.resolve(PROBE_UNANSWERED);
    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        const i = this.probes.indexOf(answer);
        if (i !== -1) this.probes.splice(i, 1);
        resolve(PROBE_UNANSWERED);
      }, PROBE_TIMEOUT_MS);
      const answer = (result: unknown) => {
        clearTimeout(timer);
        resolve(result);
      };
      this.probes.push(answer);
      this.post({ type: "STRUCTURA_PROBE" });
    });
  }

  /** Opens the element search inside the preview. */
  search(): void {
    this.post({ type: "STRUCTURA_SEARCH" });
  }

  postTheme(): void {
    const kind = vscode.window.activeColorTheme.kind;
    const dark = kind === vscode.ColorThemeKind.Dark || kind === vscode.ColorThemeKind.HighContrast;
    this.post({ type: "STRUCTURA_THEME", theme: dark ? "dark" : "light" });
  }

  dispose(): void {
    clearTimeout(this.timer);
    this.ready = false;
    for (const resolve of this.probes.splice(0)) resolve(PROBE_UNANSWERED);
    // Nothing keeps these up to date once the preview is gone.
    for (const file of this.published) this.diagnostics.delete(vscode.Uri.file(file));
    this.published.clear();
    this.statusItem.dispose();
  }

  /** For the end-to-end test: did the webview load, and what did it last receive. */
  status(): { ready: boolean; components: number; rendered: number; blocked: number } {
    return {
      ready: this.ready,
      components: this.lastGraph?.components.length ?? 0,
      rendered: this.rendered,
      blocked: this.blocked,
    };
  }

  private post(message: object): void {
    if (this.ready) void this.panel.webview.postMessage(message);
  }

  private async update(): Promise<void> {
    const generation = ++this.generation;
    // Every file below the folder, as paths relative to it: a workspace may use subfolders.
    const names = await readdir(this.folder, { recursive: true }).catch(() => [] as string[]);
    const workspace = await collectWorkspace(this.folder, names, readText);
    const result = await this.pipeline.update(workspace);
    if (generation !== this.generation) return;
    const published = publishDiagnostics(
      this.diagnostics,
      workspace.files.map((f) => f.path),
      result.diagnostics,
    );
    for (const file of this.published) {
      if (!published.has(file)) this.diagnostics.delete(vscode.Uri.file(file));
    }
    this.published = published;
    if (result.blocked) {
      const errors = result.diagnostics.filter((d) => d.severity === "error").slice(0, 5);
      this.problemLocations = errors.map((d) =>
        d.file ? { file: d.file, line: d.line ?? 1 } : null,
      );
      // Keep the last valid picture, and say why it is not following.
      this.blocked = result.blocked.reason === "errors" ? result.blocked.errors : 1;
      this.statusItem.text =
        result.blocked.reason === "errors"
          ? `$(warning) opscr: ${this.blocked} error${this.blocked === 1 ? "" : "s"} — preview not updated`
          : "$(warning) opscr: the YAML does not parse — preview not updated";
      this.statusItem.command = "workbench.actions.view.problems";
      this.statusItem.show();
      // Inside the preview too: with nothing drawn yet it would otherwise just say "waiting".
      this.lastBlocked = {
        type: "STRUCTURA_BLOCKED",
        reason: result.blocked.reason,
        errors: result.blocked.reason === "errors" ? result.blocked.errors : 0,
        problems: errors.map((d) =>
          `${d.file ? basename(d.file) : ""}${d.line ? `:${d.line}` : ""} ${d.message}`.trim(),
        ),
      };
      this.post(this.lastBlocked);
      return;
    }
    this.lastBlocked = null;
    this.problemLocations = [];
    this.blocked = 0;
    this.statusItem.hide();
    if (!result.graph) return;
    this.lastGraph = result.graph;
    this.sources = result.sources;
    this.post({ type: "STRUCTURA_LOAD_GRAPH", ...result.graph });
  }
}

const sameElement = (a: GraphElementRef | null, b: GraphElementRef | null) =>
  a === b || (a !== null && b !== null && a.kind === b.kind && a.key === b.key);

/**
 * Opens `at` in the editor already showing its file, or in the first editor column — not over
 * the preview — with the cursor on its line.
 */
async function showSource(at: SourceLocation): Promise<void> {
  const editors = vscode.window.visibleTextEditors;
  const shown = editors.find((e) => e.document.uri.fsPath === at.file);
  const position = new vscode.Position(Math.max(0, at.line - 1), 0);
  const editor = await vscode.window.showTextDocument(vscode.Uri.file(at.file), {
    viewColumn: shown?.viewColumn ?? editors[0]?.viewColumn ?? vscode.ViewColumn.One,
    selection: new vscode.Range(position, position),
  });
  editor.revealRange(editor.selection, vscode.TextEditorRevealType.InCenterIfOutsideViewport);
}

/** An open editor's unsaved text wins over the file on disk. */
async function readText(path: string): Promise<string | undefined> {
  const open = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === path);
  if (open) return open.getText();
  return readFile(path, "utf8").catch(() => undefined);
}

/** Sets the Problems entries of `files` (and any file a diagnostic names); returns those files. */
function publishDiagnostics(
  collection: vscode.DiagnosticCollection,
  files: readonly string[],
  diagnostics: readonly OpscrDiagnostic[],
): Set<string> {
  const byFile = new Map<string, vscode.Diagnostic[]>(files.map((f) => [f, []]));
  for (const d of diagnostics) {
    if (!d.file) continue;
    const line = Math.max(0, (d.line ?? 1) - 1);
    const severity =
      d.severity === "error"
        ? vscode.DiagnosticSeverity.Error
        : d.severity === "warning"
          ? vscode.DiagnosticSeverity.Warning
          : vscode.DiagnosticSeverity.Information;
    const message = [d.fieldPath ? `${d.fieldPath}: ${d.message}` : d.message, d.suggestion]
      .filter(Boolean)
      .join("\n");
    const diagnostic = new vscode.Diagnostic(
      new vscode.Range(line, 0, line, Number.MAX_SAFE_INTEGER),
      message,
      severity,
    );
    diagnostic.source = "opscr";
    if (d.ruleId) diagnostic.code = d.ruleId;
    byFile.set(d.file, [...(byFile.get(d.file) ?? []), diagnostic]);
  }
  for (const [file, list] of byFile) collection.set(vscode.Uri.file(file), list);
  return new Set(byFile.keys());
}

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection("opscr");
  const previews = new Map<string, Preview>();
  const embedRoot = vscode.Uri.joinPath(context.extensionUri, "media", "embed");

  /** Where the workspace of a manifest starts: see `workspaceRoot`. */
  const rootOf = (uri: vscode.Uri): Promise<string> =>
    workspaceRoot(
      uri.fsPath,
      async (folder) => {
        try {
          await vscode.workspace.fs.stat(vscode.Uri.file(joinPath(folder, "opscr.config.yaml")));
          return true;
        } catch {
          return false;
        }
      },
      vscode.workspace.getWorkspaceFolder(uri)?.uri.fsPath,
    );

  const open = async (uri?: vscode.Uri) => {
    const target = uri ?? vscode.window.activeTextEditor?.document.uri;
    if (!target || !isManifestPath(target.fsPath)) {
      void vscode.window.showInformationMessage(
        "Open an *.opscr.yaml file to preview its workspace.",
      );
      return;
    }
    const folder = await rootOf(target);
    const existing = previews.get(folder);
    if (existing) {
      existing.schedule();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "opscr.preview",
      `Preview: ${basename(folder)}`,
      { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true },
      { enableScripts: true, retainContextWhenHidden: true, localResourceRoots: [embedRoot] },
    );
    const html = new TextDecoder().decode(
      await vscode.workspace.fs.readFile(vscode.Uri.joinPath(embedRoot, "embed.html")),
    );
    panel.webview.html = previewHtml(
      html,
      panel.webview.asWebviewUri(embedRoot).toString(),
      panel.webview.cspSource,
    );
    const preview = new Preview(folder, panel, diagnostics);
    previews.set(folder, preview);
    // Files written outside any editor — Claude Code, git, Structura's layout sidecar — come
    // from disk: watch the folder itself.
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.file(folder), "**/*"),
    );
    const onDisk = (uri: vscode.Uri) => {
      if (isManifestPath(uri.fsPath)) preview.schedule();
    };
    watcher.onDidChange(onDisk);
    watcher.onDidCreate(onDisk);
    watcher.onDidDelete(onDisk);
    panel.onDidDispose(() => {
      watcher.dispose();
      preview.dispose();
      previews.delete(folder);
    });
    preview.schedule();
  };

  /** The preview whose folder holds the file; the innermost one when workspaces nest. */
  const forDocument = (uri: vscode.Uri) =>
    isManifestPath(uri.fsPath)
      ? [...previews.values()]
          .filter((p) => uri.fsPath.startsWith(p.folder + sep))
          .sort((a, b) => b.folder.length - a.folder.length)[0]
      : undefined;

  context.subscriptions.push(
    diagnostics,
    vscode.commands.registerCommand("opscr.openPreview", open),
    vscode.commands.registerCommand("opscr.searchPreview", () => {
      // The focused preview: VSCode's own find does not reach into a webview.
      const preview = [...previews.values()].find((p) => p.isActive()) ?? [...previews.values()][0];
      preview?.search();
    }),
    vscode.commands.registerCommand("opscr.relayoutPreview", () => {
      // The focused preview (its shortcut), else the one of the file being edited.
      const uri = vscode.window.activeTextEditor?.document.uri;
      const preview =
        [...previews.values()].find((p) => p.isActive()) ??
        (uri && forDocument(uri)) ??
        [...previews.values()][0];
      preview?.relayout();
    }),
    vscode.workspace.onDidChangeTextDocument((e) => forDocument(e.document.uri)?.schedule()),
    vscode.workspace.onDidSaveTextDocument((d) => forDocument(d.uri)?.schedule()),
    vscode.workspace.onDidCloseTextDocument((d) => forDocument(d.uri)?.schedule()),
    vscode.window.onDidChangeTextEditorSelection(({ textEditor, selections }) => {
      const uri = textEditor.document.uri;
      forDocument(uri)?.cursorAt(uri.fsPath, (selections[0]?.active.line ?? 0) + 1);
    }),
    vscode.window.onDidChangeActiveColorTheme(() => previews.forEach((p) => p.postTheme())),
    // Not contributed to the palette: lets the end-to-end test observe the preview.
    vscode.commands.registerCommand("opscr._previewProbe", (folder: string) =>
      previews.get(folder)?.probe(),
    ),
    vscode.commands.registerCommand("opscr._previewMessage", (folder: string, message: object) =>
      previews.get(folder)?.receive(message),
    ),
    vscode.commands.registerCommand("opscr._previewStatus", () =>
      Object.fromEntries([...previews].map(([folder, p]) => [folder, p.status()])),
    ),
  );
}

export function deactivate(): void {}
