import {
  DEFAULT_INITIATIVES_DIR,
  LAYOUT_FILE,
  LOCK_FILE,
  WORKSPACE_FILE,
  initiativeDelta,
  initiativeSources,
  loadProductSources,
  mergeLayouts,
  parseLayout,
  parseWorkspaceFile,
  resolveView,
  serializeLayout,
  type Box,
  type LayoutFile,
  type ProductWorkspace,
} from "opscr/core";
import type {
  DiagramSnapshot,
  PluginDiagramChanges,
  PluginDiagramChangesResult,
  PluginVersionStatus,
} from "../types/plugin.types";
import { OpscrEngine, type EngineEvent, type Projector, type TextsPort } from "./engine";
import type { SourceText } from "./patches";
import type { BindingState } from "./sync";

/**
 * opscr initiatives as Structura Versions (plugin API 1.14). A product workspace's
 * `initiatives/<name>/` is drawn in every diagram bound to the folder as the plugin's Version
 * keyed `<name>`, by an `OpscrEngine` per diagram and initiative that works on the root with the
 * initiative applied (`initiativeSources`) and writes canvas edits back as the initiative
 * (`initiativeDelta`). No UI and no host here: the pane gives it ports, a test gives it fakes.
 */

export { WORKSPACE_FILE };

/** The buffers the pane keeps, and how it drops one (deleted from the folder on Save). */
export interface BufferPort {
  get(): SourceText[];
  set(files: readonly SourceText[]): void | Promise<void>;
  remove(names: readonly string[]): void | Promise<void>;
}

/** The initiatives folder of a product workspace, or undefined when the folder is not one. */
export function initiativesDir(texts: readonly SourceText[]): string | undefined {
  const file = texts.find((t) => t.name === WORKSPACE_FILE);
  if (!file) return undefined;
  return (
    parseWorkspaceFile(file.text, WORKSPACE_FILE).workspace?.initiatives ?? DEFAULT_INITIATIVES_DIR
  );
}

/** The initiative a buffer belongs to (`initiatives/<name>/…`), if any. */
export function initiativeOfPath(name: string, dir: string | undefined): string | undefined {
  if (!dir || !name.startsWith(`${dir}/`)) return undefined;
  const rest = name.slice(dir.length + 1).split("/");
  return rest.length >= 2 ? rest[0] : undefined;
}

/** What the root engine reads: the folder's top level only (initiatives are overlays). */
export const isRootFile = (name: string) => !name.includes("/");

const caches = new WeakMap<readonly SourceText[], ProductWorkspace | null>();

/** The product workspace the buffers hold, or null when they are not one. Cached per array. */
export function productOf(
  texts: readonly SourceText[],
  isManifest: (name: string) => boolean,
  configFile: string,
): ProductWorkspace | null {
  if (caches.has(texts)) return caches.get(texts)!;
  const dir = initiativesDir(texts);
  const workspace = texts.find((t) => t.name === WORKSPACE_FILE);
  let product: ProductWorkspace | null = null;
  if (dir !== undefined && workspace) {
    const file = (t: SourceText) => ({ path: t.name, content: t.text });
    const names = new Map<string, SourceText[]>();
    for (const t of texts) {
      const name = initiativeOfPath(t.name, dir);
      if (name !== undefined) names.set(name, [...(names.get(name) ?? []), t]);
    }
    const config = texts.find((t) => t.name === configFile);
    const layout = texts.find((t) => t.name === LAYOUT_FILE && t.text.trim() !== "");
    product = loadProductSources({
      workspaceFile: file(workspace),
      dir: "",
      root: texts.filter((t) => isRootFile(t.name) && isManifest(t.name)).map(file),
      ...(layout ? { rootLayout: file(layout) } : {}),
      ...(config ? { config: file(config) } : {}),
      initiatives: [...names]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([name, files]) => {
          const at = `${dir}/${name}/`;
          const lock = files.find((f) => f.name === `${at}${LOCK_FILE}`);
          const sidecar = files.find(
            (f) => f.name === `${at}${LAYOUT_FILE}` && f.text.trim() !== "",
          );
          return {
            name,
            dir: `${dir}/${name}`,
            files: files.filter((f) => isManifest(f.name)).map(file),
            ...(lock ? { lock: file(lock) } : {}),
            ...(sidecar ? { layout: file(sidecar) } : {}),
          };
        }),
    });
  }
  caches.set(texts, product);
  return product;
}

/** An initiative as the pane and the Version list show it. */
export interface InitiativeInfo {
  name: string;
  /** `spec.displayName`, else the folder name. */
  title: string;
  status: PluginVersionStatus | null;
}

const STATUSES = new Set(["proposed", "approved", "in-progress", "done"]);

function initiativeInfos(product: ProductWorkspace | null): InitiativeInfo[] {
  return (product?.initiatives ?? []).map((i) => {
    const title = i.manifest?.spec["displayName"];
    return {
      name: i.name,
      title: typeof title === "string" && title.trim() ? title : i.name,
      status: i.status && STATUSES.has(i.status) ? (i.status as PluginVersionStatus) : null,
    };
  });
}

/** What an initiative changes in one View, as the View shows it. */
export interface ViewChanges {
  added: string[];
  modified: string[];
  retired: string[];
  /** Edges the View draws that the initiative adds or removes. */
  edges: number;
}

/** Nothing the View shows changes. */
const unchanged = (c: ViewChanges) =>
  c.added.length + c.modified.length + c.retired.length + c.edges === 0;

/**
 * Each View's changes under an initiative: the View resolved on the root against the View
 * resolved on the root with the initiative applied. A View the initiative adds is all added; one
 * it drops is all retired. Views it does not change are left out.
 */
export function initiativeViewChanges(
  product: ProductWorkspace,
  name: string,
): Map<string, ViewChanges> {
  const cached = viewChangesCache.get(product)?.get(name);
  if (cached) return cached;
  const result = computeViewChanges(product, name);
  if (!viewChangesCache.has(product)) viewChangesCache.set(product, new Map());
  viewChangesCache.get(product)!.set(name, result);
  return result;
}

const viewChangesCache = new WeakMap<ProductWorkspace, Map<string, Map<string, ViewChanges>>>();

function computeViewChanges(product: ProductWorkspace, name: string): Map<string, ViewChanges> {
  const initiative = product.initiatives.find((i) => i.name === name);
  const result = new Map<string, ViewChanges>();
  if (!initiative) return result;
  const views = new Set(
    [product.root, initiative.workspace].flatMap((w) =>
      w.getByKind("View").map((m) => m.metadata.name),
    ),
  );
  const modified = new Set(initiative.diff.modified);
  const edgeKey = (e: { from: string; to: string; type: string }) => `${e.from}>${e.to}:${e.type}`;
  for (const view of [...views].sort()) {
    const before = resolveView(product.root, view);
    const after = resolveView(initiative.workspace, view);
    const was = new Map((before?.nodes ?? []).map((n) => [n.id, n]));
    const is = new Map((after?.nodes ?? []).map((n) => [n.id, n]));
    const wasEdges = new Set((before?.edges ?? []).map(edgeKey));
    const isEdges = new Set((after?.edges ?? []).map(edgeKey));
    const changes: ViewChanges = {
      added: [...is.keys()].filter((k) => !was.has(k)),
      // Changed in the YAML, or moved to another box in this View.
      modified: [...is.values()]
        .filter((n) => was.has(n.id) && (modified.has(n.id) || was.get(n.id)!.parent !== n.parent))
        .map((n) => n.id),
      retired: [...was.keys()].filter((k) => !is.has(k)),
      edges:
        [...isEdges].filter((k) => !wasEdges.has(k)).length +
        [...wasEdges].filter((k) => !isEdges.has(k)).length,
    };
    if (!unchanged(changes)) result.set(view, changes);
  }
  return result;
}

const sameBox = (a: Box, b: Box | undefined) =>
  b !== undefined &&
  Math.round(a.x) === Math.round(b.x) &&
  Math.round(a.y) === Math.round(b.y) &&
  Math.round(a.width) === Math.round(b.width) &&
  Math.round(a.height) === Math.round(b.height);

/** The boxes of `merged` the root does not already have: what the initiative's sidecar keeps. */
function layoutDelta(root: LayoutFile | undefined, merged: LayoutFile): LayoutFile {
  const only = (boxes: ReadonlyMap<string, Box>, base: ReadonlyMap<string, Box> | undefined) =>
    new Map([...boxes].filter(([key, box]) => !sameBox(box, base?.get(key))));
  const views = new Map<string, Map<string, Box>>();
  for (const [name, boxes] of merged.views) {
    const delta = only(boxes, root?.views.get(name));
    if (delta.size > 0) views.set(name, delta);
  }
  return { elements: only(merged.elements, root?.elements), views };
}

/**
 * The texts an initiative engine reads and writes: the root with the initiative applied, the
 * config, and the merged layout sidecar. Writes go back to the initiative's own buffers — the
 * manifests through `initiativeDelta`, the sidecar as the boxes that differ from the root's.
 */
function initiativeTexts(options: {
  buffers: BufferPort;
  name: string;
  isManifest: (name: string) => boolean;
  configFile: string;
  /** Problems turning an edit into the initiative (it is then not written). */
  onProblem?: (messages: string[]) => void;
}): TextsPort {
  const { buffers, name, isManifest, configFile } = options;
  const product = () => productOf(buffers.get(), isManifest, configFile);
  const sidecars = (p: ProductWorkspace) => {
    const initiative = p.initiatives.find((i) => i.name === name);
    const root = p.sources.rootLayout ? parseLayout(p.sources.rootLayout.content) : undefined;
    const own = initiative?.sources.layout
      ? parseLayout(initiative.sources.layout.content)
      : undefined;
    const retired = new Set(
      (initiative?.composed.entries ?? []).filter((e) => e.change === "retired").map((e) => e.key),
    );
    return { initiative, root, own, retired };
  };
  return {
    get() {
      const p = product();
      if (!p || !p.initiatives.some((i) => i.name === name)) return [];
      const merged: SourceText[] = initiativeSources(p, name).map((f) => ({
        name: f.path,
        text: f.content,
      }));
      const config = buffers.get().find((t) => t.name === configFile);
      const { root, own, retired } = sidecars(p);
      const layout =
        root || own
          ? [{ name: LAYOUT_FILE, text: serializeLayout(mergeLayouts(root, own, retired)) }]
          : [];
      return [...merged, ...(config ? [config] : []), ...layout];
    },
    async set(files) {
      const p = product();
      const initiative = p?.initiatives.find((i) => i.name === name);
      if (!p || !initiative) return;
      const written: SourceText[] = [];
      const removed: string[] = [];

      const manifests = files.filter((f) => isManifest(f.name));
      if (manifests.length > 0) {
        const byName = new Map(manifests.map((f) => [f.name, f.text]));
        const current = initiativeSources(p, name);
        const known = new Set(current.map((f) => f.path));
        const merged = [
          ...current.map((f) => ({ path: f.path, content: byName.get(f.path) ?? f.content })),
          ...manifests
            .filter((f) => !known.has(f.name))
            .map((f) => ({ path: f.name, content: f.text })),
        ];
        const delta = initiativeDelta(p, name, merged);
        if (delta.diagnostics.length > 0) {
          options.onProblem?.(delta.diagnostics.map((d) => d.message));
          return;
        }
        for (const [path, content] of delta.files) {
          if (content === null) removed.push(path);
          else written.push({ name: path, text: content });
        }
      }

      const layout = files.find((f) => f.name === LAYOUT_FILE);
      const parsed = layout ? parseLayout(layout.text) : undefined;
      if (parsed) {
        const { root } = sidecars(p);
        const delta = layoutDelta(root, parsed);
        const path = `${initiative.sources.dir}/${LAYOUT_FILE}`;
        const had = initiative.sources.layout?.content;
        const empty = delta.elements.size === 0 && delta.views.size === 0;
        const text = serializeLayout(delta);
        if (!(empty && had === undefined) && text !== had) written.push({ name: path, text });
      }

      if (written.length > 0) await buffers.set(written);
      if (removed.length > 0) await buffers.remove(removed);
    },
  };
}

/** A diagram bound to the folder, as the initiative engines draw on it. */
export interface InitiativeTarget {
  diagramId: string;
  /**
   * The opscr View it draws; undefined for the bound diagram, which draws what the root engine
   * draws there (the whole workspace, where edits are written, or the View the pane shows).
   */
  view?: string;
  /** What the root engine created on it: root elements keep their canvas ids in a Version. */
  baseBinding(): BindingState;
  /** The diagram that draws a View, for a box that opens one (as the base's boxes do). */
  resolveLink?: (view: string) => string | undefined;
}

/** What the host offers (the plugin API's 1.14 Versions surface). */
export interface VersionsHost {
  getDiagram(diagramId: string, versionKey: string): DiagramSnapshot | null;
  applyChanges(
    changes: PluginDiagramChanges,
    diagramId: string,
    version: { key: string; name: string; status: PluginVersionStatus | null },
  ): PluginDiagramChangesResult;
  /** The plugin's own Versions of a diagram. */
  versions(
    diagramId: string,
  ): Array<{ key: string | null; name: string; status: PluginVersionStatus | null }>;
  removeVersion(diagramId: string, key: string): void;
  /** The key of the Version a diagram shows (null: the base). */
  activeVersion?(diagramId: string): string | null;
  setActiveVersion?(diagramId: string, key: string): void;
}

/** An initiative engine's own part of the binding, kept on top of the root's. */
export interface InitiativeBinding {
  state: BindingState;
  /** Root keys the initiative's Version no longer draws (retired, or changed beyond an update). */
  droppedIds: string[];
  droppedConnections: string[];
  /**
   * The root's canvas ids the Version was drawn over. When the root draws an element again (the
   * bound diagram showed a View, the folder was bound again) the Version is drawn again from the
   * YAML: its binding would name ids that are no longer there, and a sync would read them as
   * deleted.
   */
  baseIds?: Record<string, string>;
  /** The View it was drawn for (none: the whole workspace). */
  view?: string;
}

export type InitiativeBindings = Record<string, InitiativeBinding>;

export interface InitiativeVersionsOptions {
  host: VersionsHost;
  buffers: BufferPort;
  targets(): InitiativeTarget[];
  bindings: { get(): InitiativeBindings; set(next: InitiativeBindings): void | Promise<void> };
  project: Projector;
  isManifest: (name: string) => boolean;
  configFile: string;
  onEvent?: (
    event: { initiative: string; diagramId: string; event: EngineEvent } | { problem: string[] },
  ) => void;
}

const keyOf = (diagramId: string, name: string) => `${diagramId}\u0000${name}`;

const without = <T>(record: Record<string, T>, keys: ReadonlySet<string>) =>
  Object.fromEntries(Object.entries(record).filter(([key]) => !keys.has(key)));

export class InitiativeVersions {
  private readonly engines = new Map<string, OpscrEngine>();
  /** Engines that have not drawn yet: their first step moves the canvas to the merged sidecar. */
  private readonly fresh = new Set<string>();
  private queue: Promise<void> = Promise.resolve();

  constructor(private readonly options: InitiativeVersionsOptions) {}

  private enqueue<T>(step: () => Promise<T>): Promise<T | undefined> {
    const run = this.queue.then(step);
    this.queue = run.then(
      () => undefined,
      (error: unknown) => console.error("[opscr] initiative versions step failed:", error),
    );
    return run.catch(() => undefined);
  }

  /** The initiatives the buffers hold now. */
  initiatives(): InitiativeInfo[] {
    const { buffers, isManifest, configFile } = this.options;
    return initiativeInfos(productOf(buffers.get(), isManifest, configFile));
  }

  /**
   * The initiatives a target draws as Versions: every one on the whole workspace; on a View, only
   * those that change what the View shows — elsewhere the Version would be the base again.
   */
  private drawnOn(target: InitiativeTarget, infos: InitiativeInfo[]): InitiativeInfo[] {
    const view = target.view ?? target.baseBinding().view;
    if (view === undefined) return infos;
    const { buffers, isManifest, configFile } = this.options;
    const product = productOf(buffers.get(), isManifest, configFile);
    if (!product) return [];
    return infos.filter((i) => initiativeViewChanges(product, i.name).has(view));
  }

  /**
   * Removes an initiative's Version from a target, with its engine and binding. Nothing is lost:
   * every canvas edit in it was written to the initiative's buffers already.
   */
  private async drop(target: InitiativeTarget, name: string) {
    const { host, bindings } = this.options;
    const key = keyOf(target.diagramId, name);
    host.removeVersion(target.diagramId, name);
    this.engines.delete(key);
    this.fresh.delete(key);
    if (key in bindings.get()) {
      const { [key]: _gone, ...rest } = bindings.get();
      void _gone;
      await bindings.set(rest);
    }
  }

  /** The canvas id an initiative's Version gives an element key on a diagram, if it draws it. */
  canvasIdOf(diagramId: string, name: string, key: string): string | undefined {
    const target = this.options.targets().find((t) => t.diagramId === diagramId);
    return target ? this.bindingFor(target, name).ids[key] : undefined;
  }

  /** The root binding with the initiative's own entries on top, minus what it dropped. */
  private bindingFor(target: InitiativeTarget, name: string): BindingState {
    const base = target.baseBinding();
    const own = this.options.bindings.get()[keyOf(target.diagramId, name)];
    const droppedIds = new Set(own?.droppedIds ?? []);
    const droppedConnections = new Set(own?.droppedConnections ?? []);
    const view = target.view ?? base.view;
    return {
      ids: { ...without(base.ids, droppedIds), ...own?.state.ids },
      connections: { ...without(base.connections, droppedConnections), ...own?.state.connections },
      signatures: { ...without(base.signatures, droppedIds), ...own?.state.signatures },
      ...(own?.state.tombstones ? { tombstones: own.state.tombstones } : {}),
      ...(view !== undefined ? { view } : {}),
    };
  }

  /** The Version was drawn over root canvas ids the root no longer has under those keys. */
  private stale(target: InitiativeTarget, name: string): boolean {
    const own = this.options.bindings.get()[keyOf(target.diagramId, name)];
    if (!own) return false;
    if (!own.baseIds) return true;
    const base = target.baseBinding();
    if ((target.view ?? base.view) !== own.view) return true;
    return Object.entries(own.baseIds).some(([key, id]) => key in base.ids && base.ids[key] !== id);
  }

  /**
   * Drops a stale Version — its copies of root elements hold ids the root no longer draws — so
   * the next draw makes it again from the YAML. Nothing is lost: every canvas edit in it was
   * written to the initiative's buffers already. The Version stays on screen if it was.
   */
  private async rebuild(target: InitiativeTarget, info: InitiativeInfo) {
    const { host } = this.options;
    const shown = host.activeVersion?.(target.diagramId) === info.name;
    await this.drop(target, info.name);
    host.applyChanges({}, target.diagramId, {
      key: info.name,
      name: info.title,
      status: info.status,
    });
    if (shown) host.setActiveVersion?.(target.diagramId, info.name);
  }

  private saveBinding(target: InitiativeTarget, name: string, state: BindingState) {
    const key = keyOf(target.diagramId, name);
    const all = this.options.bindings.get();
    const base = target.baseBinding();
    const view = target.view ?? base.view;
    const before = this.bindingFor(target, name);
    const own = all[key];
    // What the engine let go of stays let go of, even though the root binding still has it.
    const droppedIds = new Set([
      ...(own?.droppedIds ?? []).filter((k) => !(k in state.ids)),
      ...Object.keys(before.ids).filter((k) => !(k in state.ids)),
    ]);
    const droppedConnections = new Set([
      ...(own?.droppedConnections ?? []).filter((k) => !(k in state.connections)),
      ...Object.keys(before.connections).filter((k) => !(k in state.connections)),
    ]);
    return this.options.bindings.set({
      ...all,
      [key]: {
        state,
        droppedIds: [...droppedIds],
        droppedConnections: [...droppedConnections],
        baseIds: { ...base.ids },
        ...(view !== undefined ? { view } : {}),
      },
    });
  }

  private engineFor(target: InitiativeTarget, info: InitiativeInfo): OpscrEngine {
    const key = keyOf(target.diagramId, info.name);
    const cached = this.engines.get(key);
    if (cached) return cached;
    const { host, buffers, project, isManifest, configFile } = this.options;
    const meta = () => {
      const now = this.initiatives().find((i) => i.name === info.name) ?? info;
      return { key: info.name, name: now.title, status: now.status };
    };
    const engine = new OpscrEngine({
      texts: initiativeTexts({
        buffers,
        name: info.name,
        isManifest,
        configFile,
        onProblem: (problem) => this.options.onEvent?.({ problem }),
      }),
      diagram: {
        get: () => host.getDiagram(target.diagramId, info.name),
        apply: (changes) => host.applyChanges(changes, target.diagramId, meta()),
      },
      binding: {
        get: () => this.bindingFor(target, info.name),
        set: (state) => this.saveBinding(target, info.name, state),
      },
      project,
      isManifest,
      configFile,
      ...(target.resolveLink ? { resolveLink: target.resolveLink } : {}),
      onEvent: (event) =>
        this.options.onEvent?.({ initiative: info.name, diagramId: target.diagramId, event }),
    });
    this.engines.set(key, engine);
    this.fresh.add(key);
    return engine;
  }

  /** The merged sidecar an initiative engine reads, if the folder has one. */
  private sidecarFor(name: string): string | undefined {
    const { buffers, isManifest, configFile } = this.options;
    return initiativeTexts({ buffers, name, isManifest, configFile })
      .get()
      .find((f) => f.name === LAYOUT_FILE)?.text;
  }

  /**
   * Draws one initiative on one target. The first time, the Version starts as the base's
   * picture: the initiative's own sidecar boxes (moved or new elements) are applied first.
   */
  private async draw(target: InitiativeTarget, info: InitiativeInfo, sidecar = false) {
    const key = keyOf(target.diagramId, info.name);
    if (this.stale(target, info.name)) await this.rebuild(target, info);
    const engine = this.engineFor(target, info);
    const layout = this.sidecarFor(info.name);
    if ((sidecar || this.fresh.has(key)) && layout !== undefined) {
      this.fresh.delete(key);
      await engine.sidecarChanged(layout);
    } else {
      this.fresh.delete(key);
      await engine.sync();
    }
  }

  /**
   * After the folder changed: every initiative has its Version in every target (created, its name
   * and status brought up to date) and is drawn from the YAML; Versions of initiatives that are
   * gone are removed.
   */
  sync(): Promise<void> {
    return this.enqueue(async () => {
      const { host } = this.options;
      const infos = this.initiatives();
      for (const target of this.options.targets()) {
        const drawn = this.drawnOn(target, infos);
        const names = new Set(drawn.map((i) => i.name));
        const versions = host.versions(target.diagramId);
        for (const version of versions) {
          if (version.key !== null && !names.has(version.key)) await this.drop(target, version.key);
        }
        for (const info of drawn) {
          const known = versions.find((v) => v.key === info.name);
          if (!known || known.name !== info.title || known.status !== info.status) {
            host.applyChanges({}, target.diagramId, {
              key: info.name,
              name: info.title,
              status: info.status,
            });
          }
          await this.draw(target, info);
        }
      }
    });
  }

  /** A sidecar changed outside (a `git pull`): every Version moves to its merged sidecar. */
  sidecarChanged(): Promise<void> {
    return this.enqueue(async () => {
      for (const target of this.options.targets()) {
        for (const info of this.drawnOn(target, this.initiatives())) {
          await this.draw(target, info, true);
        }
      }
    });
  }

  /** A diagram showing an initiative's Version changed on the canvas. */
  canvasChanged(diagramId: string, name: string): Promise<void> {
    return this.enqueue(async () => {
      const target = this.options.targets().find((t) => t.diagramId === diagramId);
      const info = this.initiatives().find((i) => i.name === name);
      if (!target || !info) return;
      // Over a stale Version the edit cannot be told from the ids it lost: draw it again.
      if (this.stale(target, info.name)) return this.draw(target, info);
      await this.engineFor(target, info).canvasChanged();
    });
  }

  /** Forget every engine (another folder, another diagram). */
  reset(): void {
    this.engines.clear();
    this.fresh.clear();
  }
}
