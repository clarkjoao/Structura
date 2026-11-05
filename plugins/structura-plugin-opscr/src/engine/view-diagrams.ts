import type {
  DiagramSnapshot,
  PluginDiagramChanges,
  PluginDiagramChangesResult,
  PluginDiagramInput,
} from "../types/plugin.types";
import {
  OpscrEngine,
  type EngineEvent,
  type Projector,
  type TextsPort,
  type ViewInfo,
} from "./engine";
import type { SourceText } from "./patches";
import { emptyBinding, type BindingState } from "./sync";

/**
 * One Structura diagram per opscr View (plugin API 1.13). Each View keeps its own diagram — made
 * on first sight, filled and kept in sync from the YAML, its boxes that open another view linked to
 * that view's diagram — by an `OpscrEngine` bound to it in view mode (a projection: the canvas
 * follows the YAML, only positions flow back, to the view's entry of the layout sidecar). The
 * diagram of a View that leaves the YAML is kept, listed as an orphan: the user deletes it.
 *
 * No UI and no host here: the pane gives it ports, a test gives it fakes.
 */

/** What the host offers to keep several diagrams (the plugin API's 1.13 surface). */
export interface DiagramsPort {
  createDiagram(input: PluginDiagramInput): string;
  getDiagram(id: string): DiagramSnapshot | null;
  applyChanges(changes: PluginDiagramChanges, diagramId: string): PluginDiagramChangesResult;
}

/** What the plugin remembers about the diagrams it made. */
export interface ViewDiagramsState {
  /** View name → the diagram drawn for it. */
  diagrams: Record<string, string>;
  /** Diagram id → what its engine created on it. */
  bindings: Record<string, BindingState>;
}

export const emptyViewDiagrams = (): ViewDiagramsState => ({ diagrams: {}, bindings: {} });

export interface StatePort {
  get(): ViewDiagramsState;
  set(state: ViewDiagramsState): void | Promise<void>;
}

export type ViewDiagramsEvent =
  /** The diagrams of the workspace's Views, and the ones whose View is gone. */
  | {
      type: "view-diagrams";
      diagrams: Array<{ view: string; diagramId: string; name: string }>;
      orphans: Array<{ view: string; diagramId: string }>;
    }
  | { type: "engine"; view: string; event: EngineEvent };

export interface ViewDiagramsOptions {
  host: DiagramsPort;
  texts: TextsPort;
  state: StatePort;
  project: Projector;
  isManifest: (name: string) => boolean;
  configFile: string;
  onEvent?: (event: ViewDiagramsEvent) => void;
}

/** The C4 level a View's diagram is made at. */
const LEVELS: Record<string, string> = {
  SystemContext: "context",
  Container: "container",
  Component: "component",
  Deployment: "deployment",
};

export class ViewDiagrams {
  private queue: Promise<void> = Promise.resolve();
  private readonly engines = new Map<string, OpscrEngine>();
  /** The Views the YAML declares as of the last sync: only they have diagrams to open. */
  private live = new Set<string>();

  constructor(private readonly options: ViewDiagramsOptions) {}

  /** One step at a time, so the engines never write the layout sidecar over each other. */
  private enqueue<T>(step: () => Promise<T>): Promise<T | undefined> {
    const run = this.queue.then(step);
    this.queue = run.then(
      () => undefined,
      (error: unknown) => console.error("[opscr] view diagrams step failed:", error),
    );
    return run.catch(() => undefined);
  }

  private manifests(): SourceText[] {
    return this.options.texts.get().filter((f) => this.options.isManifest(f.name));
  }

  /** The diagram drawing a View the YAML declares, for a box that opens it; undefined if none. */
  diagramFor(view: string): string | undefined {
    const id = this.options.state.get().diagrams[view];
    return this.live.has(view) && id !== undefined && this.options.host.getDiagram(id) !== null
      ? id
      : undefined;
  }

  /** The view a diagram was made for, if this folder made it. */
  viewOf(diagramId: string): string | undefined {
    return Object.entries(this.options.state.get().diagrams).find(
      ([, id]) => id === diagramId,
    )?.[0];
  }

  private engineFor(view: string, diagramId: string): OpscrEngine {
    const cached = this.engines.get(diagramId);
    if (cached) return cached;
    const { host, texts, state, project, isManifest, configFile } = this.options;
    const engine = new OpscrEngine({
      texts,
      diagram: {
        get: () => host.getDiagram(diagramId),
        apply: (changes) => host.applyChanges(changes, diagramId),
      },
      binding: {
        get: () => state.get().bindings[diagramId] ?? { ...emptyBinding(), view },
        set: (binding) => {
          const current = state.get();
          return state.set({ ...current, bindings: { ...current.bindings, [diagramId]: binding } });
        },
      },
      project: (manifests, config, previous) => project(manifests, config, previous, view),
      isManifest,
      configFile,
      resolveLink: (target) => this.diagramFor(target),
      onEvent: (event) => this.options.onEvent?.({ type: "engine", view, event }),
    });
    this.engines.set(diagramId, engine);
    return engine;
  }

  /** The Views the YAML declares now, with what a diagram for each needs. */
  private async views(): Promise<ViewInfo[] | undefined> {
    const config = this.options.texts.get().find((f) => f.name === this.options.configFile);
    const projection = await this.options.project(this.manifests(), config, undefined, undefined);
    return projection.viewInfos;
  }

  /**
   * After the YAML changed: every View has its diagram (made when it has none, or when the user
   * deleted it), and each diagram follows its View. Does nothing while the YAML does not parse.
   */
  sync(): Promise<void> {
    return this.enqueue(async () => {
      const infos = await this.views();
      if (!infos) return;
      const { host, state } = this.options;
      this.live = new Set(infos.map((i) => i.name));

      // Every diagram exists before any is filled, so a box can open one made after it.
      let current = state.get();
      for (const info of infos) {
        const known = current.diagrams[info.name];
        if (known !== undefined && host.getDiagram(known) !== null) continue;
        const id = host.createDiagram({
          name: info.title ?? info.name,
          ...(info.description ? { description: info.description } : {}),
          level: LEVELS[info.type] ?? "container",
        });
        const { [known ?? ""]: _gone, ...bindings } = current.bindings;
        void _gone;
        current = {
          diagrams: { ...current.diagrams, [info.name]: id },
          bindings: { ...bindings, [id]: { ...emptyBinding(), view: info.name } },
        };
        if (known !== undefined) this.engines.delete(known);
      }
      await state.set(current);

      for (const info of infos)
        await this.engineFor(info.name, current.diagrams[info.name]!).sync();
      this.report(infos);
    });
  }

  private report(infos: readonly ViewInfo[]): void {
    const { host, state } = this.options;
    const diagrams = state.get().diagrams;
    const live = new Set(infos.map((i) => i.name));
    this.options.onEvent?.({
      type: "view-diagrams",
      diagrams: infos.flatMap((i) =>
        diagrams[i.name]
          ? [{ view: i.name, diagramId: diagrams[i.name]!, name: i.title ?? i.name }]
          : [],
      ),
      orphans: Object.entries(diagrams)
        .filter(([view, id]) => !live.has(view) && host.getDiagram(id) !== null)
        .map(([view, diagramId]) => ({ view, diagramId })),
    });
  }

  /** A view's diagram changed on the canvas (a box moved, an undo): its positions go to the sidecar. */
  canvasChanged(diagramId: string): Promise<void> {
    return this.enqueue(async () => {
      const view = this.viewOf(diagramId);
      if (view === undefined) return;
      await this.engineFor(view, diagramId).canvasChanged();
    });
  }

  /** The layout sidecar changed outside (a `git pull`): every view's diagram moves to it. */
  sidecarChanged(sidecar: string): Promise<void> {
    return this.enqueue(async () => {
      for (const [view, id] of Object.entries(this.options.state.get().diagrams)) {
        if (this.options.host.getDiagram(id))
          await this.engineFor(view, id).sidecarChanged(sidecar);
      }
    });
  }

  /** The diagram ids this folder made for Views, for the pane to listen to. */
  diagramIds(): string[] {
    return Object.values(this.options.state.get().diagrams);
  }
}
