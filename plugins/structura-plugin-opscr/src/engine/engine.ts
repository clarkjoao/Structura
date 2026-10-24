import {
  LAYOUT_FILE,
  VISUAL_FILE,
  parseVisualFile,
  withVisualLayer,
  type DrawnThrough,
} from "../generated/opscr-mapping";
import type {
  DiagramSnapshot,
  PluginDiagramChanges,
  PluginDiagramChangesResult,
} from "../types/plugin.types";
import { addElementsToYaml, type AddChoice } from "./adopt";
import { keyOf, nameAt, renameElement, type SourceText } from "./patches";
import { reconcile, renameInBinding, retire, type UnwrittenConnection } from "./reconcile";
import {
  emptyBinding,
  planSync,
  previousLayout,
  sidecarMoves,
  sidecarText,
  type BindingState,
} from "./sync";
import type { ImporterGraph, ViewLayoutResult } from "../generated/opscr-mapping";
import { mergeBinding, splitBinding, visualMoves, visualText, withoutVisual } from "./visual";

/**
 * The binding between a diagram and a folder of opscr manifests, without any UI: YAML → canvas
 * (sync), canvas → YAML (reconcile), the layout sidecar, renames, palette adoption and outside
 * changes, serialized in one queue. The Structura document pane runs it over its buffers, the
 * active diagram and the plugin storage; another host (the editable embed, say) can run it over
 * its own.
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
  /** The opscr View to draw; undefined draws the whole workspace. */
  view?: string,
) => Promise<{ graph?: ImporterGraph; diagnostics: unknown[]; views?: string[] }>;

/** What the engine reports; the host turns it into UI. */
export type EngineEvent =
  | { type: "synced"; elements: number }
  /**
   * The Views the workspace declares, the one drawn (undefined: the whole workspace) and the
   * boxes of the drawn view that open another view.
   */
  | { type: "views"; views: string[]; current: string | undefined; links: ViewLink[] }
  | { type: "parse-error" }
  /** `requireValid`: the YAML has opscr errors, so the diagram was left as it was. */
  | { type: "invalid"; errors: number }
  | { type: "diagnostics"; diagnostics: unknown[] }
  | { type: "outside"; ids: string[] }
  /** Canvas connections the YAML does not carry as drawn (`reconcile`). */
  | { type: "unwritten"; connections: UnwrittenConnection[] }
  | { type: "rename-refused"; name: string }
  | { type: "provider-refused"; names: string[] }
  | { type: "added"; keys: string[] }
  /** Manifest edges drawn as the chain they were collapsed from (`opscr.visual.json`). */
  | { type: "drawn-through"; edges: DrawnThrough[] }
  /** `opscr.visual.json` is there but cannot be read: drawn without the visual layer. */
  | { type: "visual-unreadable" }
  /** A step threw: the diagram may no longer match the text until the next sync. */
  | { type: "failed"; error: unknown };

/** A box of the drawn view that opens another view (`drillDown`). */
export interface ViewLink {
  key: string;
  name: string;
  view: string;
}

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

  /** Runs `step` after every queued one; a failing step is logged and reported, the queue goes on. */
  enqueue<T>(step: () => Promise<T>): Promise<T | undefined> {
    const run = this.queue.then(step);
    this.queue = run.then(
      () => undefined,
      (error: unknown) => {
        console.error("[opscr] engine step failed:", error);
        this.emit({ type: "failed", error });
      },
    );
    return run.catch(() => undefined);
  }

  /** Forget the last synced text (a new folder or diagram). */
  reset() {
    this.synced = [];
  }

  /**
   * Canvas → YAML. True when the text changed. The visual layer is not the YAML's: reconcile
   * sees the diagram and the binding without it, and the visual part of the binding is kept.
   */
  private async reconcileNow(): Promise<boolean> {
    const diagram = this.options.diagram.get();
    // A View is a projection: its structure is not edited from the canvas.
    if (!diagram || this.options.binding.get().view !== undefined) return false;
    const { manifest, visual } = splitBinding(this.options.binding.get());
    const result = reconcile(withoutVisual(diagram, visual), manifest, this.manifests());
    if (result.skipped) return false;
    if (result.changed) await this.options.texts.set(result.files);
    await this.options.binding.set(mergeBinding(result.binding, visual));
    const { remove, disconnect, update } = result.revert;
    if (remove.length + disconnect.length + update.length > 0) {
      await this.options.diagram.apply(result.revert);
    }
    this.emit({ type: "outside", ids: result.outside });
    this.emit({ type: "unwritten", connections: result.unwritten });
    if (result.refused.length > 0) this.emit({ type: "rename-refused", name: result.refused[0]! });
    if (result.refusedProviders.length > 0) {
      this.emit({ type: "provider-refused", names: result.refusedProviders });
    }
    return result.changed;
  }

  /** Rewrites `opscr.visual.json` from the canvas: moves, resizes and deletions of its elements. */
  private async writeVisual() {
    const diagram = this.options.diagram.get();
    const current = this.text(VISUAL_FILE);
    if (!diagram || current === undefined || this.options.binding.get().view !== undefined) return;
    const text = visualText(current, this.options.binding.get(), diagram);
    if (text !== null && text !== current)
      await this.options.texts.set([{ name: VISUAL_FILE, text }]);
  }

  /** The projection with the visual layer drawn on it, when the folder has one. */
  private withVisual(graph: ImporterGraph): ImporterGraph {
    if (this.options.binding.get().view !== undefined) return graph;
    const text = this.text(VISUAL_FILE);
    if (text === undefined || text.trim() === "") return graph;
    const visual = parseVisualFile(text);
    if (!visual) {
      this.emit({ type: "visual-unreadable" });
      return graph;
    }
    const layered = withVisualLayer(graph, visual);
    this.emit({ type: "drawn-through", edges: layered.drawnThrough });
    return layered.graph;
  }

  /** Rewrites the layout sidecar from the canvas, when the arrangement changed. */
  private async writeSidecar() {
    const diagram = this.options.diagram.get();
    const current = this.text(LAYOUT_FILE);
    if (!diagram || current === undefined) return;
    const text = sidecarText(this.options.binding.get(), diagram, current);
    if (current !== text) await this.options.texts.set([{ name: LAYOUT_FILE, text }]);
  }

  /** YAML → canvas. */
  private async syncNow(retries = 3): Promise<void> {
    const diagram = this.options.diagram.get();
    if (!diagram) return;
    const binding = this.options.binding.get();
    const manifests = this.manifests();
    const config = this.text(this.options.configFile);
    const projection = await this.options.project(
      manifests,
      config === undefined ? undefined : { name: this.options.configFile, text: config },
      previousLayout(binding, diagram, this.text(LAYOUT_FILE)),
      binding.view,
    );
    this.emit({ type: "diagnostics", diagnostics: projection.diagnostics });
    if (projection.views) {
      this.emit({
        type: "views",
        views: projection.views,
        current: binding.view,
        links: (projection.graph?.components ?? []).flatMap((c) =>
          c.linkedView !== undefined ? [{ key: c.key, name: c.name, view: c.linkedView }] : [],
        ),
      });
    }
    if (!projection.graph) return this.emit({ type: "parse-error" });
    if (this.options.requireValid) {
      const errors = projection.diagnostics.filter(
        (d) => (d as { severity?: unknown }).severity === "error",
      ).length;
      if (errors > 0) return this.emit({ type: "invalid", errors });
    }
    // The projection takes a while: the user may have opened another diagram meanwhile —
    // changes go to the active one, so the plan must not — or edited this one, and a plan
    // against the old YAML would take the edit back (an element deleted meanwhile drawn
    // again): the edit goes into the YAML first, then the YAML is projected again.
    const now = this.options.diagram.get();
    if (!now || now.id !== diagram.id) return;
    if (retries > 0 && JSON.stringify(now) !== JSON.stringify(diagram)) {
      await this.reconcileNow();
      return this.syncNow(retries - 1);
    }
    const plan = planSync(this.withVisual(projection.graph), binding, now);
    const result = plan.empty
      ? { idsByKey: {}, connectionIds: [] }
      : await this.options.diagram.apply(plan.changes);
    const next = retire(binding, plan.commit(result), this.synced);
    await this.options.binding.set(binding.view !== undefined ? { ...next, view: binding.view } : next);
    this.synced = manifests;
    await this.writeSidecar();
    this.emit({ type: "synced", elements: projection.graph.components.length });
  }

  /**
   * Draws another View of the workspace on the bound diagram (undefined: the whole workspace).
   * What the binding created leaves the canvas first — the same element is a different box in
   * another view — and the new projection is laid out from the view's own sidecar boxes.
   */
  showView(view: string | undefined) {
    return this.enqueue(async () => {
      const binding = this.options.binding.get();
      if (binding.view === view) return;
      const diagram = this.options.diagram.get();
      if (!diagram) return;
      // Canvas edits of the view being left are settled first (positions go to its sidecar).
      await this.reconcileNow();
      await this.writeVisual();
      await this.writeSidecar();
      const live = new Set(diagram.components.map((c) => c.id));
      const remove = Object.values(binding.ids).filter((id) => live.has(id));
      if (remove.length > 0) await this.options.diagram.apply({ remove });
      await this.options.binding.set(view === undefined ? emptyBinding() : { ...emptyBinding(), view });
      this.synced = [];
      await this.syncNow();
    });
  }

  /** After a text change: canvas edits first, so the sync never takes them back. */
  sync() {
    return this.enqueue(async () => {
      await this.reconcileNow();
      await this.writeVisual();
      await this.syncNow();
    });
  }

  /** After a diagram change (canvas edit, undo/redo, or the engine's own changes). */
  canvasChanged() {
    return this.enqueue(async () => {
      const changed = await this.reconcileNow();
      // Before any sync: a visual element deleted on the canvas must leave the file first, or
      // the sync would draw it again.
      await this.writeVisual();
      if (changed) await this.syncNow();
      else await this.writeSidecar();
    });
  }

  /** `opscr.visual.json` changed outside: its elements move to where it says, then sync. */
  visualChanged() {
    return this.enqueue(async () => {
      const diagram = this.options.diagram.get();
      const text = this.text(VISUAL_FILE);
      const visual = text ? parseVisualFile(text) : null;
      if (diagram && visual) {
        const move = visualMoves(visual, this.options.binding.get(), diagram);
        if (move.length > 0) await this.options.diagram.apply({ move });
      }
      await this.reconcileNow();
      await this.syncNow();
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
      // A View is a projection: rename in the YAML, or in the whole-workspace diagram.
      if (this.options.binding.get().view !== undefined) return "refused";
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
      if (this.options.binding.get().view !== undefined) return;
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
