import { readFile, readdir, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import * as vscode from "vscode";
import type { Diagnostic as OpscrDiagnostic } from "opscr/core";
import { LAYOUT_FILE } from "../generated/opscr-mapping";
import { OpscrEngine } from "../generated/opscr-engine/engine";
import { CONFIG_FILE, isManifest, projector } from "../generated/opscr-engine/project";
import { emptyBinding, type BindingState } from "../generated/opscr-engine/sync";
import { FolderTexts, type FolderIO } from "./folder-texts";
import { WebviewDiagram } from "./webview-diagram";

const SYNC_DELAY_MS = 300;
const isTracked = (name: string) =>
  isManifest(name) || name === CONFIG_FILE || name === LAYOUT_FILE;

/** The folder's files through VSCode: open documents first, edits as WorkspaceEdits. */
function folderIO(folder: string): FolderIO {
  const uri = (name: string) => vscode.Uri.file(join(folder, name));
  const openDocument = (name: string) =>
    vscode.workspace.textDocuments.find((d) => d.uri.fsPath === uri(name).fsPath);
  return {
    list: () => readdir(folder).catch(() => []),
    async read(name) {
      const open = openDocument(name);
      if (open) return open.getText();
      return readFile(join(folder, name), "utf8").catch(() => undefined);
    },
    async writeDocument(name, text) {
      const edit = new vscode.WorkspaceEdit();
      const target = uri(name);
      const exists = await vscode.workspace.fs.stat(target).then(
        () => true,
        () => false,
      );
      if (!exists && !openDocument(name)) {
        edit.createFile(target, { ignoreIfExists: true });
        edit.insert(target, new vscode.Position(0, 0), text);
      } else {
        const document = await vscode.workspace.openTextDocument(target);
        const whole = new vscode.Range(
          new vscode.Position(0, 0),
          document.lineAt(document.lineCount - 1).range.end,
        );
        edit.replace(target, whole, text);
      }
      await vscode.workspace.applyEdit(edit);
    },
    writeDisk: (name, text) => writeFile(join(folder, name), text, "utf8"),
  };
}

/**
 * The editable diagram of one opscr folder: Structura's canvas in a webview, bound to the
 * folder's documents by the opscr binding engine — typing in the YAML redraws the diagram, and
 * diagram edits become (undoable, unsaved) edits of the documents.
 */
export class DiagramEditor {
  private readonly texts: FolderTexts;
  private readonly diagram: WebviewDiagram;
  private readonly engine: OpscrEngine;
  /** In memory only: each editor starts from a fresh canvas, so ids from before mean nothing. */
  private binding: BindingState = emptyBinding();
  private timer: NodeJS.Timeout | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private ready = false;
  private elements = 0;
  private invalid = 0;
  /** Says why the diagram is not following the YAML, while it is not. */
  private readonly statusItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

  constructor(
    readonly folder: string,
    private readonly panel: vscode.WebviewPanel,
    private readonly publish: (
      files: readonly string[],
      diagnostics: readonly OpscrDiagnostic[],
    ) => void,
  ) {
    this.texts = new FolderTexts(folderIO(folder), isTracked, LAYOUT_FILE);
    this.diagram = new WebviewDiagram((message) => void panel.webview.postMessage(message));
    this.engine = new OpscrEngine({
      texts: this.texts,
      diagram: this.diagram,
      binding: { get: () => this.binding, set: (state) => void (this.binding = state) },
      project: projector,
      isManifest,
      configFile: CONFIG_FILE,
      // Files here change whole (Claude Code, git, another editor's save): draw only what opscr
      // validates, and keep the last valid diagram meanwhile.
      requireValid: true,
      onEvent: (event) => {
        if (event.type === "synced") {
          this.elements = event.elements;
          this.invalid = 0;
          this.statusItem.hide();
        }
        if (event.type === "invalid" || event.type === "parse-error") {
          this.invalid = event.type === "invalid" ? event.errors : 1;
          this.statusItem.text =
            event.type === "invalid"
              ? `$(warning) opscr: ${event.errors} error${event.errors === 1 ? "" : "s"} — diagram not updated`
              : "$(warning) opscr: the YAML does not parse — diagram not updated";
          this.statusItem.command = "workbench.actions.view.problems";
          this.statusItem.show();
        }
        if (event.type === "diagnostics") {
          const files = this.texts
            .get()
            .filter((f) => isManifest(f.name))
            .map((f) => join(folder, f.name));
          const diagnostics = (event.diagnostics as OpscrDiagnostic[]).map((d) => ({
            ...d,
            ...(d.file ? { file: join(folder, d.file) } : {}),
          }));
          this.publish(files, diagnostics);
        }
      },
    });

    panel.webview.onDidReceiveMessage((message: unknown) => {
      const kind = this.diagram.receive(message);
      if (kind === "ready") void this.start();
      else if (kind === "snapshot" && this.ready) void this.engine.canvasChanged();
    });

    // Typing in the folder's documents, and changes on disk (git, other tools).
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((e) =>
        this.seen(e.document.uri, e.document.getText()),
      ),
    );
    const watcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(vscode.Uri.file(folder), "*"),
    );
    const fromDisk = async (uri: vscode.Uri) => {
      if (vscode.workspace.textDocuments.some((d) => d.uri.fsPath === uri.fsPath)) return;
      this.seen(uri, await readFile(uri.fsPath, "utf8").catch(() => undefined));
    };
    watcher.onDidChange(fromDisk);
    watcher.onDidCreate(fromDisk);
    watcher.onDidDelete((uri) => this.seen(uri, undefined));
    this.disposables.push(watcher);
  }

  /** The webview is listening: read the folder and draw it. */
  private async start() {
    this.ready = false;
    this.binding = emptyBinding();
    this.engine.reset();
    await this.texts.load();
    this.ready = true;
    await this.engine.sync();
  }

  private seen(uri: vscode.Uri, text: string | undefined) {
    if (!this.ready || uri.fsPath !== join(this.folder, basename(uri.fsPath))) return;
    const name = basename(uri.fsPath);
    if (!this.texts.update(name, text)) return;
    clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (name === LAYOUT_FILE && text) void this.engine.sidecarChanged(text);
      else void this.engine.sync();
    }, SYNC_DELAY_MS);
  }

  /** For the end-to-end test: is it drawing, and what. */
  status() {
    return {
      ready: this.ready,
      elements: this.elements,
      invalid: this.invalid,
      components: this.diagram.get()?.components.length ?? 0,
    };
  }

  /** For the end-to-end test: a change as if the user made it on the canvas. */
  canvasEdit(changes: unknown) {
    void this.panel.webview.postMessage({ type: "STRUCTURA_EDITOR_APPLY", requestId: -1, changes });
  }

  /** For the end-to-end test: a diagram component's id by its label. */
  componentId(label: string) {
    return this.diagram.get()?.components.find((c) => c.label === label)?.id;
  }

  dispose() {
    clearTimeout(this.timer);
    this.statusItem.dispose();
    for (const d of this.disposables) d.dispose();
  }
}
