/**
 * opscr Preview — a live, read-only Structura diagram of the opscr workspace of the active
 * `*.opscr.yaml`. The extension host validates the YAML with opscr and turns it into a graph
 * (the technical view, ELK, stable placement); the webview is Structura's embed preview, which
 * draws it. The YAML is edited in VSCode — by the user or Claude Code — never from the diagram.
 */
import { readFile, readdir } from "node:fs/promises";
import { dirname } from "node:path";
import * as vscode from "vscode";
import type { Diagnostic as OpscrDiagnostic } from "opscr/core";
import { collectWorkspace, isManifestPath, PreviewPipeline } from "./pipeline";
import { previewHtml } from "./webview-html";

const UPDATE_DELAY_MS = 300;

class Preview {
  private readonly pipeline = new PreviewPipeline();
  private timer: NodeJS.Timeout | undefined;
  private ready = false;
  private rendered = 0;
  private lastGraph: { components: unknown[] } | undefined;
  /** Opscr errors keeping the last picture on screen (0 while it follows the YAML). */
  private blocked = 0;
  /** Says why the preview is not following the YAML, while it is not. */
  private readonly statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
  /** Monotonic: an update that finishes after a newer one started is dropped. */
  private generation = 0;

  constructor(
    readonly folder: string,
    private readonly panel: vscode.WebviewPanel,
    private readonly diagnostics: vscode.DiagnosticCollection,
  ) {
    panel.webview.onDidReceiveMessage((message: { type?: string; nodes?: number }) => {
      if (message?.type === "STRUCTURA_RENDERED") this.rendered = message.nodes ?? 0;
      if (message?.type !== "STRUCTURA_READY") return;
      this.ready = true;
      this.postTheme();
      if (this.lastGraph) this.post({ type: "STRUCTURA_LOAD_GRAPH", ...this.lastGraph });
    });
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
    const names = await readdir(this.folder).catch(() => [] as string[]);
    const workspace = await collectWorkspace(this.folder, names, readText);
    const result = await this.pipeline.update(workspace);
    if (generation !== this.generation) return;
    publishDiagnostics(
      this.diagnostics,
      workspace.files.map((f) => f.path),
      result.diagnostics,
    );
    if (result.blocked) {
      // Keep the last valid picture, and say why it is not following.
      this.blocked = result.blocked.reason === "errors" ? result.blocked.errors : 1;
      this.statusItem.text =
        result.blocked.reason === "errors"
          ? `$(warning) opscr: ${this.blocked} error${this.blocked === 1 ? "" : "s"} — preview not updated`
          : "$(warning) opscr: the YAML does not parse — preview not updated";
      this.statusItem.command = "workbench.actions.view.problems";
      this.statusItem.show();
      return;
    }
    this.blocked = 0;
    this.statusItem.hide();
    if (!result.graph) return;
    this.lastGraph = result.graph;
    this.post({ type: "STRUCTURA_LOAD_GRAPH", ...result.graph });
  }
}

/** An open editor's unsaved text wins over the file on disk. */
async function readText(path: string): Promise<string | undefined> {
  const open = vscode.workspace.textDocuments.find((d) => d.uri.fsPath === path);
  if (open) return open.getText();
  return readFile(path, "utf8").catch(() => undefined);
}

function publishDiagnostics(
  collection: vscode.DiagnosticCollection,
  files: readonly string[],
  diagnostics: readonly OpscrDiagnostic[],
): void {
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
}

export function activate(context: vscode.ExtensionContext): void {
  const diagnostics = vscode.languages.createDiagnosticCollection("opscr");
  const previews = new Map<string, Preview>();
  const embedRoot = vscode.Uri.joinPath(context.extensionUri, "media", "embed");

  const open = async (uri?: vscode.Uri) => {
    const target = uri ?? vscode.window.activeTextEditor?.document.uri;
    if (!target || !isManifestPath(target.fsPath)) {
      void vscode.window.showInformationMessage(
        "Open an *.opscr.yaml file to preview its workspace.",
      );
      return;
    }
    const folder = dirname(target.fsPath);
    const existing = previews.get(folder);
    if (existing) {
      existing.schedule();
      return;
    }
    const panel = vscode.window.createWebviewPanel(
      "opscr.preview",
      `Preview: ${folder.split("/").pop()}`,
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
      new vscode.RelativePattern(vscode.Uri.file(folder), "*"),
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

  const forDocument = (uri: vscode.Uri) =>
    isManifestPath(uri.fsPath) ? previews.get(dirname(uri.fsPath)) : undefined;

  context.subscriptions.push(
    diagnostics,
    vscode.commands.registerCommand("opscr.openPreview", open),
    vscode.commands.registerCommand("opscr.searchPreview", () => {
      // The focused preview: VSCode's own find does not reach into a webview.
      const preview = [...previews.values()].find((p) => p.isActive()) ?? [...previews.values()][0];
      preview?.search();
    }),
    vscode.commands.registerCommand("opscr.relayoutPreview", () => {
      const uri = vscode.window.activeTextEditor?.document.uri;
      const preview = (uri && forDocument(uri)) ?? [...previews.values()][0];
      preview?.relayout();
    }),
    vscode.workspace.onDidChangeTextDocument((e) => forDocument(e.document.uri)?.schedule()),
    vscode.workspace.onDidSaveTextDocument((d) => forDocument(d.uri)?.schedule()),
    vscode.workspace.onDidCloseTextDocument((d) => forDocument(d.uri)?.schedule()),
    vscode.window.onDidChangeActiveColorTheme(() => previews.forEach((p) => p.postTheme())),
    // Not contributed to the palette: lets the end-to-end test observe the preview.
    vscode.commands.registerCommand("opscr._previewStatus", () =>
      Object.fromEntries([...previews].map(([folder, p]) => [folder, p.status()])),
    ),
  );
}

export function deactivate(): void {}
