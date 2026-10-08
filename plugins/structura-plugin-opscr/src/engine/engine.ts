import { LAYOUT_FILE } from "../generated/opscr-mapping";
import type {
  DiagramSnapshot,
  PluginDiagramChanges,
  PluginDiagramChangesResult,
} from "../types/plugin.types";
import { addElementsToYaml, type AddChoice } from "./adopt";
import { keyOf, nameAt, renameElement, type SourceText } from "./patches";
import { reconcile, renameInBinding, retire } from "./reconcile";
import {
  emptyBinding,
  planSync,
  previousLayout,
  sidecarMoves,
  sidecarText,
  type BindingState,
} from "./sync";
import type { ImporterGraph, ViewLayoutResult } from "../generated/opscr-mapping";

/**
 * The binding between a diagram and a folder of opscr manifests, without any UI: YAML → canvas
 * (sync), canvas → YAML (reconcile), the layout sidecar, renames, palette adoption and outside
 * changes, serialized in one queue. The Structura document pane and the VSCode editor run it over
 * their own files, diagram and storage.
 */

/** The text the engine reads and edits: manifests, the config and the layout sidecar. */
export interface TextsPort {
  get(): SourceText[];
  /** New texts; names not known yet are new files. */
  set(files: readonly SourceText[]): void | Promise<void>;
}

export interface DiagramPort {
  /** The bound diagram as it is now, or null when it is not available (another one is open). */
  get(): DiagramSnapshot | null;
  apply(
    changes: PluginDiagramChanges,
  ): PluginDiagramChangesResult | Promise<PluginDiagramChangesResult>;
}

export interface BindingPort {
  get(): BindingState;
  set(state: BindingState): void | Promise<void>;
}

/** YAML → the graph the diagram should show (opscr/core + the stable layout). */
export type Projector = (
  manifests: SourceText[],
  config: SourceText | undefined,
  previous: ViewLayoutResult | undefined,
) => Promise<{ graph?: ImporterGraph; diagnostics: unknown[] }>;

/** What the engine reports; the host turns it into UI. */
export type EngineEvent =
  | { type: "synced"; elements: number }
  | { type: "parse-error" }
  /** `requireValid`: the YAML has opscr errors, so the diagram was left as it was. */
  | { type: "invalid"; errors: number }
  | { type: "diagnostics"; diagnostics: unknown[] }
  | { type: "outside"; ids: string[] }
  | { type: "rename-refused"; name: string }
  | { type: "provider-refused"; names: string[] }
  | { type: "added"; keys: string[] };

export interface EngineOptions {
  texts: TextsPort;
  diagram: DiagramPort;
  binding: BindingPort;
  project: Projector;
  isManifest: (name: string) => boolean;
  configFile: string;
  /**
   * Draw only YAML that opscr validates without errors: until then the diagram keeps its last
   * valid picture (warnings do not block). For hosts where whole files change at once — another
   * tool, an agent writing them — rather than as the user types.
   */
  requireValid?: boolean;
  onEvent?: (event: EngineEvent) => void;
}

export class OpscrEngine {
  private queue: Promise<void> = Promise.resolve();
  /** The manifests as of the last sync: the text a canvas undo of that sync brings back. */
  private synced: SourceText[] = [];

  constructor(private readonly options: EngineOptions) {}

  private emit(event: EngineEvent) {
    this.options.onEvent?.(event);
  }

  private manifests(): SourceText[] {
    return this.options.texts.get().filter((f) => this.options.isManifest(f.name));
  }

  private text(name: string): string | undefined {
    return this.options.texts.get().find((f) => f.name === name)?.text;
  }

  /** Runs `step` after every queued one; a failing step is logged, the queue goes on. */
  enqueue<T>(step: () => Promise<T>): Promise<T | undefined> {
    const run = this.queue.then(step);
    this.queue = run.then(
      () => undefined,
      (error: unknown) => console.error("[opscr] engine step failed:", error),
    );
    return run.catch(() => undefined);
  }

  /** Forget the last synced text (a new folder or diagram). */
  reset() {
    this.synced = [];
  }

  /** Canvas → YAML. True when the text changed. */
  private async reconcileNow(): Promise<boolean> {
    const diagram = this.options.diagram.get();
    if (!diagram) return false;
    const result = reconcile(diagram, this.options.binding.get(), this.manifests());
    if (result.skipped) return false;
    if (result.changed) await this.options.texts.set(result.files);
    await this.options.binding.set(result.binding);
    const { remove, disconnect, update } = result.revert;
    if (remove.length + disconnect.length + update.length > 0) {
      await this.options.diagram.apply(result.revert);
    }
    this.emit({ type: "outside", ids: result.outside });
    if (result.refused.length > 0) this.emit({ type: "rename-refused", name: result.refused[0]! });
    if (result.refusedProviders.length > 0) {
      this.emit({ type: "provider-refused", names: result.refusedProviders });
    }
    return result.changed;
  }

  /** Rewrites the layout sidecar from the canvas, when the arrangement changed. */
  private async writeSidecar() {
    const diagram = this.options.diagram.get();
    const current = this.text(LAYOUT_FILE);
    if (!diagram || current === undefined) return;
    const text = sidecarText(this.options.binding.get(), diagram);
    if (current !== text) await this.options.texts.set([{ name: LAYOUT_FILE, text }]);
  }

  /** YAML → canvas. */
  private async syncNow() {
    const diagram = this.options.diagram.get();
    if (!diagram) return;
    const binding = this.options.binding.get();
    const manifests = this.manifests();
    const config = this.text(this.options.configFile);
    const projection = await this.options.project(
      manifests,
      config === undefined ? undefined : { name: this.options.configFile, text: config },
      previousLayout(binding, diagram, this.text(LAYOUT_FILE)),
    );
    this.emit({ type: "diagnostics", diagnostics: projection.diagnostics });
    if (!projection.graph) return this.emit({ type: "parse-error" });
    if (this.options.requireValid) {
      const errors = projection.diagnostics.filter(
        (d) => (d as { severity?: unknown }).severity === "error",
      ).length;
      if (errors > 0) return this.emit({ type: "invalid", errors });
    }
    const plan = planSync(projection.graph, binding, diagram);
    const result = plan.empty
      ? { idsByKey: {}, connectionIds: [] }
      : await this.options.diagram.apply(plan.changes);
    await this.options.binding.set(retire(binding, plan.commit(result), this.synced));
    this.synced = manifests;
    await this.writeSidecar();
    this.emit({ type: "synced", elements: projection.graph.components.length });
  }

  /** After a text change: canvas edits first, so the sync never takes them back. */
  sync() {
    return this.enqueue(async () => {
      await this.reconcileNow();
      await this.syncNow();
    });
  }

  /** After a diagram change (canvas edit, undo/redo, or the engine's own changes). */
  canvasChanged() {
    return this.enqueue(async () => {
      if (await this.reconcileNow()) await this.syncNow();
      else await this.writeSidecar();
    });
  }

  /** The layout sidecar changed outside (a `git pull`): move the canvas to it, then sync. */
  sidecarChanged(sidecar: string) {
    return this.enqueue(async () => {
      const diagram = this.options.diagram.get();
      if (diagram) {
        const move = sidecarMoves(this.options.binding.get(), diagram, sidecar);
        if (move.length > 0) await this.options.diagram.apply({ move });
      }
      await this.reconcileNow();
      await this.syncNow();
    });
  }

  /**
   * Renames the element named at `offset` in `file` across every manifest, keeping its canvas
   * element. Resolves to "gone" (nothing named there any more), "refused" (empty or taken) or
   * undefined when done.
   */
  rename(file: string, offset: number, newName: string) {
    return this.enqueue(async (): Promise<"gone" | "refused" | undefined> => {
      await this.reconcileNow();
      const manifests = this.manifests();
      const at = nameAt(manifests, file, offset);
      const to = newName.trim();
      if (!at) return "gone";
      if (to === at.ref.name) return undefined;
      const files = to ? renameElement(manifests, at.ref, to) : null;
      if (!files) return "refused";
      await this.options.texts.set(files);
      const binding = this.options.binding.get();
      const from = keyOf(at.ref);
      const id = binding.ids[from];
      await this.options.binding.set(
        renameInBinding(binding, from, keyOf({ ...at.ref, name: to })),
      );
      if (id) await this.options.diagram.apply({ update: [{ id, name: to }] });
      await this.syncNow();
      return undefined;
    });
  }

  /** Writes canvas elements outside the YAML into it (the chosen Kinds). */
  addToYaml(choices: readonly AddChoice[]) {
    return this.enqueue(async () => {
      await this.reconcileNow();
      const diagram = this.options.diagram.get();
      if (!diagram || choices.length === 0) return;
      const result = addElementsToYaml(
        this.manifests(),
        this.options.binding.get(),
        diagram,
        choices,
      );
      await this.options.texts.set(result.files);
      await this.options.binding.set(result.binding);
      // Connections drawn to the new elements become edges now that both ends are bound.
      await this.reconcileNow();
      await this.syncNow();
      this.emit({ type: "added", keys: result.added });
    });
  }

  /**
   * New manifest texts from elsewhere (the chat): applied, synced, and answered with the canvas
   * ids of what changed — components created or bound to a `touched` key, connections created.
   */
  async applyFiles(files: readonly SourceText[], touched: readonly string[]) {
    const before = this.options.binding.get();
    await this.options.texts.set(files);
    await this.sync();
    const after = this.options.binding.get();
    const oldIds = new Set(Object.values(before.ids));
    const oldConnections = new Set(Object.values(before.connections));
    const touchedIds = touched.flatMap((key) => after.ids[key] ?? []);
    const createdIds = Object.values(after.ids).filter((id) => !oldIds.has(id));
    return {
      componentIds: [...new Set([...createdIds, ...touchedIds])],
      connectionIds: Object.values(after.connections).filter((id) => !oldConnections.has(id)),
    };
  }
}

export { emptyBinding };
