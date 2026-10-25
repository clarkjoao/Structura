import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Diagnostic } from "opscr/core";
import type {
  PluginEditorMarker,
  PluginEditorRename,
  PluginFolder,
  PluginPanelProps,
  StructuraPluginApi,
} from "../types/plugin.types";
import { CONFIG_FILE, isManifest, projector, type Projection } from "../project";
import { nameAt, refOf, type SourceText } from "../engine/patches";
import { openSession } from "../session";
import {
  importDrawioFile,
  isWorkspaceFile,
  notArchitecturePages,
  reviewItems,
} from "../import-drawio";
import {
  DRAWN_KINDS,
  LAYOUT_FILE,
  VISUAL_FILE,
  kindFor,
  providersFor,
  type DrawnThrough,
  type GraphElementRef,
  type SourceLocation,
} from "../generated/opscr-mapping";
import type { AddChoice } from "../engine/adopt";
import { OpscrEngine, type EngineEvent, type ViewLink } from "../engine/engine";
import { useViewDiagrams } from "./useViewDiagrams";
import type { UnwrittenConnection } from "../engine/reconcile";
import { emptyBinding, type BindingState } from "../engine/sync";
import { changedFiles, mergeDisk, resolveConflict, toStats, type Stats } from "../engine/watch";
import { text, type Locale } from "./i18n";
import { Icon, Section } from "./ui";
import {
  ARROW_RIGHT,
  BUTTON_CLASS,
  FILE_PLUS,
  FOLDER,
  ICON_BUTTON_CLASS,
  LABEL_CLASS,
  LINK_ROW_CLASS,
  PLUS,
  PRIMARY_BUTTON_CLASS,
  RELOAD,
  SAVE,
  SELECT_CLASS,
  UNLINK,
  UPLOAD,
} from "./styles";

/**
 * The bound folder is the AS-IS: the pane reads and writes the diagram's base, never the Version
 * the canvas may be showing (initiative editing comes with the Versions-as-initiatives work).
 */
const BASE = { base: true } as const;

const SYNC_DELAY_MS = 300;

/** What an empty folder starts with: one valid manifest to copy from. */
const FIRST_MANIFEST = {
  name: "architecture.opscr.yaml",
  key: "Application/my-app",
  text: [
    "apiVersion: opscr.dev/v1",
    "kind: Application",
    "metadata:",
    "  name: my-app",
    "spec:",
    "  provider: EKS",
    "  language: Go",
    "  description: What this application does",
    "",
  ].join("\n"),
};

const sameElement = (a: GraphElementRef | null, b: GraphElementRef | null) =>
  a === b || (a !== null && b !== null && a.kind === b.kind && a.key === b.key);

interface Buffer {
  name: string;
  /** Text on disk, as last read or saved. */
  disk: string;
  /** Text in the editor. */
  text: string;
  /** Disk text that changed under an unsaved edit, until the user picks a side. */
  conflict?: string;
}

/** How often the folder is checked for changes made outside Structura. */
const WATCH_INTERVAL_MS = 2000;
const isTracked = (name: string) =>
  isManifest(name) || name === CONFIG_FILE || name === LAYOUT_FILE || name === VISUAL_FILE;
/** The sidecars: written by the engine from the canvas, never shown as an editor tab. */
const isSidecar = (name: string) =>
  name === LAYOUT_FILE || name === VISUAL_FILE || name === ANALYSIS_FILE;
/** Written by a draw.io import; read for its review list, never edited here. */
const ANALYSIS_FILE = "analysis.json";

interface StoredBinding {
  folderName: string;
  state: BindingState;
}

const storageKey = (diagramId: string) => `binding:${diagramId}`;

const manifestsOf = (buffers: readonly Buffer[]): SourceText[] =>
  buffers.filter((b) => isManifest(b.name)).map((b) => ({ name: b.name, text: b.text }));

const toMarker = (d: Diagnostic): PluginEditorMarker => ({
  line: d.line ?? 1,
  message: [d.fieldPath ? `${d.fieldPath}: ${d.message}` : d.message, d.suggestion]
    .filter(Boolean)
    .join("\n"),
  severity: d.severity === "error" ? "error" : d.severity === "warning" ? "warning" : "info",
});

/**
 * The opscr document pane: binds the active diagram to a folder of manifests, edits them
 * in the host editor, saves them, and keeps the diagram in sync as the user types.
 */
export function createOpscrPane(api: StructuraPluginApi) {
  const { CodeEditor } = api.ui;
  /**
   * The open folder and its buffers per diagram, kept when the pane closes or another diagram
   * opens: the buffers hold unsaved edits — the user's and the canvas's — that are not on disk.
   */
  const sessions = new Map<
    string,
    { folder: PluginFolder; buffers: Buffer[]; selected: string | null; knownStats: Stats }
  >();
  /**
   * Bindings in storage, in order per diagram: a read waits for the writes before it, so going
   * back to a diagram while a step of its engine is still saving reads what that step saved.
   */
  const saving = new Map<string, Promise<void>>();
  const bindings = {
    get: (diagramId: string) =>
      (saving.get(diagramId) ?? Promise.resolve()).then(() =>
        api.storage.get<StoredBinding>(storageKey(diagramId)),
      ),
    write: (diagramId: string, write: () => Promise<void>): Promise<void> => {
      const done = (saving.get(diagramId) ?? Promise.resolve()).then(write, write);
      saving.set(
        diagramId,
        done.catch(() => undefined),
      );
      return done;
    },
  };

  return function OpscrPane({ context }: PluginPanelProps) {
    const t = useMemo(() => text(context.locale as Locale), [context.locale]);
    const [diagramId, setDiagramId] = useState(() => api.getActiveDiagramId());
    /** The diagram the pane is on now — work started for another one must not land here. */
    const currentDiagram = useRef(diagramId);
    /** The diagram whose binding `bindingRef` holds, once read from storage. */
    const [loadedFor, setLoadedFor] = useState<string | null>(null);
    /** Written with `loadedFor`, never from a render (see `buffersRef`). */
    const loadedForRef = useRef(loadedFor);
    const [stored, setStored] = useState<StoredBinding | null>(null);
    const [folder, setFolder] = useState<PluginFolder | null>(null);
    const folderRef = useRef(folder);
    const [buffers, setBuffers] = useState<Buffer[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const selectedRef = useRef(selected);
    const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
    const [status, setStatus] = useState<string>("");
    /** The last engine step threw: the diagram may not match the text until a sync works. */
    const [failed, setFailed] = useState(false);
    /** Canvas elements the YAML does not declare, and the Kind/provider picked for each. */
    const [outside, setOutside] = useState<string[]>([]);
    const [picks, setPicks] = useState<Record<string, { kind: string; provider: string }>>({});
    const bindingRef = useRef<StoredBinding | null>(null);
    /**
     * The buffers as of the last change, ahead of the render that shows them: the engine reads
     * and writes them between renders. Every change goes through `commitBuffers`; a render never
     * writes it back — one for an earlier, more urgent update (a click) would carry stale text.
     */
    const buffersRef = useRef<Buffer[]>([]);
    const commitBuffers = useCallback((next: Buffer[]) => {
      buffersRef.current = next;
      setBuffers(next);
    }, []);
    const timer = useRef<ReturnType<typeof setTimeout>>();
    /** The folder's file stats as of the last read or save, to notice outside changes. */
    const knownStats = useRef<Stats>({});
    /** The folder came back from `sessions`: canvas edits made meanwhile are not in the YAML yet. */
    const restored = useRef(false);
    /** Canvas connections the YAML does not carry as drawn. */
    const [unwritten, setUnwritten] = useState<UnwrittenConnection[]>([]);
    const [drawnThrough, setDrawnThrough] = useState<DrawnThrough[]>([]);
    /** The last projection with a graph: where elements are written, and what is not drawn. */
    const [projection, setProjection] = useState<Projection | null>(null);
    /** The Views the workspace declares and the drawn view's boxes that open another one. */
    const [views, setViews] = useState<{ names: string[]; links: ViewLink[] }>({
      names: [],
      links: [],
    });
    const projectionRef = useRef(projection);
    // Read by callbacks: the values the user sees, i.e. the committed ones. Not written while
    // rendering, where an urgent update can render ahead of a pending one with older state.
    useLayoutEffect(() => {
      currentDiagram.current = diagramId;
      folderRef.current = folder;
      selectedRef.current = selected;
      projectionRef.current = projection;
    });
    /** A line for the editor to go to; a new token goes again. */
    const [reveal, setReveal] = useState<{ line: number; token: number } | null>(null);
    /** The element last pointed at from either side, so neither side echoes the other. */
    const pointed = useRef<GraphElementRef | null>(null);
    /** The file whose folder version is shown beside the user's, while comparing. */
    const [comparing, setComparing] = useState<string | null>(null);

    // Follow the active diagram.
    useEffect(() => api.onDiagramChange(() => setDiagramId(api.getActiveDiagramId())), []);

    // Load what the plugin remembers about this diagram; the folder needs a user gesture —
    // unless it is still open from before the pane closed or the diagram changed.
    useEffect(() => {
      const session = diagramId ? sessions.get(diagramId) : undefined;
      setFolder(session?.folder ?? null);
      commitBuffers(session?.buffers ?? []);
      setSelected(session?.selected ?? null);
      knownStats.current = session?.knownStats ?? {};
      restored.current = session !== undefined;
      setDiagnostics([]);
      setProjection(null);
      setViews({ names: [], links: [] });
      setUnwritten([]);
      setComparing(null);
      pointed.current = null;
      // Until this diagram's binding is read, the engine has none to work with: syncing then
      // would draw everything again beside what the canvas already shows.
      bindingRef.current = null;
      loadedForRef.current = null;
      setLoadedFor(null);
      if (!diagramId) {
        setStored(null);
        return;
      }
      let current = true;
      void bindings.get(diagramId).then((value) => {
        if (!current) return; // another diagram since
        bindingRef.current = value;
        loadedForRef.current = diagramId;
        setStored(value);
        setLoadedFor(diagramId);
      });
      return () => {
        current = false;
        const open = folderRef.current;
        if (!open) sessions.delete(diagramId);
        else {
          sessions.set(diagramId, {
            folder: open,
            buffers: buffersRef.current,
            selected: selectedRef.current,
            knownStats: knownStats.current,
          });
        }
      };
    }, [diagramId, commitBuffers]);

    // A comparison ends with its conflict, however it ended (a side picked, a save, the folder
    // going back to the saved text).
    useEffect(() => {
      if (comparing && buffers.find((b) => b.name === comparing)?.conflict === undefined) {
        setComparing(null);
      }
    }, [buffers, comparing]);

    const persist = useCallback(
      async (binding: StoredBinding) => {
        if (!diagramId) return;
        bindingRef.current = binding;
        loadedForRef.current = diagramId;
        setStored(binding);
        setLoadedFor(diagramId);
        await bindings.write(diagramId, () => api.storage.set(storageKey(diagramId), binding));
      },
      [diagramId],
    );

    /** New texts for the buffers; names the folder does not have yet become new, unsaved files. */
    const setTexts = useCallback(
      (files: readonly SourceText[]) => {
        const byName = new Map(files.map((f) => [f.name, f.text]));
        const known = new Set(buffersRef.current.map((b) => b.name));
        const next = [
          ...buffersRef.current.map((b) => ({ ...b, text: byName.get(b.name) ?? b.text })),
          ...files
            .filter((f) => !known.has(f.name))
            .map((f) => ({ name: f.name, disk: "", text: f.text })),
        ];
        commitBuffers(next);
      },
      [commitBuffers],
    );

    // The binding engine over this pane's buffers, the active diagram and the plugin storage.
    const syncViewDiagrams = useRef<() => Promise<void> | undefined>(() => undefined);
    const onEvent = useRef<(event: EngineEvent) => void>(() => {});
    onEvent.current = (event) => {
      // Only a sync that got through (or stopped at broken YAML) says the diagram is current again.
      if (event.type === "failed") setFailed(true);
      else if (event.type === "synced") {
        setFailed(false);
        setStatus(t.synced(event.elements));
        // The diagrams of the Views follow the YAML the whole-workspace diagram just followed.
        void syncViewDiagrams.current?.();
      } else if (event.type === "parse-error" || event.type === "invalid") {
        setFailed(false);
        setStatus(t.parseError);
      } else if (event.type === "diagnostics") setDiagnostics(event.diagnostics as Diagnostic[]);
      else if (event.type === "views") setViews({ names: event.views, links: event.links });
      else if (event.type === "outside") setOutside(event.ids);
      else if (event.type === "unwritten") setUnwritten(event.connections);
      else if (event.type === "rename-refused") setStatus(t.renameRefused(event.name));
      else if (event.type === "provider-refused") setStatus(t.providerRefused(event.names));
      else if (event.type === "added") setStatus(t.addedToYaml(event.keys));
      else if (event.type === "drawn-through") setDrawnThrough(event.edges);
      else if (event.type === "visual-unreadable") setStatus(t.visualUnreadable);
    };
    const engine = useMemo(() => {
      /**
       * Whether the pane is still on this engine's diagram, with its binding read. A step that
       * was running when the user opened another diagram finishes for this one: its texts and
       * events are not the pane's any more, and its binding goes to this diagram's own key.
       */
      const live = () => currentDiagram.current === diagramId && loadedForRef.current === diagramId;
      let folderName: string | undefined;
      return new OpscrEngine({
        texts: {
          get: () => buffersRef.current.map((b) => ({ name: b.name, text: b.text })),
          set: (files) => (live() ? setTexts(files) : undefined),
        },
        diagram: {
          get: () => {
            if (!live()) return null;
            const diagram = api.getDiagram(undefined, BASE);
            return diagram && diagram.id === diagramId ? diagram : null;
          },
          apply: (changes) => api.applyChanges(changes),
        },
        binding: {
          get: () => {
            folderName = bindingRef.current?.folderName ?? folderName;
            return bindingRef.current?.state ?? emptyBinding();
          },
          set: (state) => {
            if (live() && bindingRef.current) return persist({ ...bindingRef.current, state });
            if (diagramId && folderName) {
              const name = folderName;
              return bindings.write(diagramId, () =>
                api.storage.set(storageKey(diagramId), { folderName: name, state }),
              );
            }
          },
        },
        // Keeps what the pane shows besides the graph: sources and what is not drawn.
        project: async (...args) => {
          const result = await projector(...args);
          if (result.graph && live()) setProjection(result);
          return result;
        },
        isManifest,
        configFile: CONFIG_FILE,
        onEvent: (event) => (live() ? onEvent.current(event) : undefined),
      });
    }, [diagramId, persist, setTexts]);

    const sync = useCallback(() => engine.sync(), [engine]);

    const viewDiagrams = useViewDiagrams({
      api,
      diagramId,
      ready: folder !== null && loadedFor === diagramId,
      buffersRef,
      setTexts,
    });
    syncViewDiagrams.current = viewDiagrams.sync;

    // Canvas edits (and undo/redo) of the bound diagram reach the YAML while the folder is open.
    useEffect(() => {
      if (!folder || !diagramId || loadedFor !== diagramId) return;
      if (restored.current) {
        restored.current = false;
        // Canvas edits made meanwhile reach the YAML; the sync after it gives the pane its
        // projection again (where elements are written, what is not drawn).
        void engine.sync();
      }
      return api.onDiagramChange((changed) => {
        if (changed === diagramId) void engine.canvasChanged();
      });
    }, [folder, diagramId, engine, loadedFor]);

    /** Opens `at` in the editor: its file, its line. */
    const showSource = useCallback((at: SourceLocation) => {
      setSelected(at.file);
      setReveal((r) => ({ line: at.line, token: (r?.token ?? 0) + 1 }));
    }, []);

    // The canvas and the YAML point at each other: selecting an element opens the YAML that
    // writes it, and the element the cursor is in is lit on the canvas.
    useEffect(() => {
      if (!folder || !diagramId) return;
      // Pressing on an element to drag it selects it too, and a drag is not a request to read
      // its YAML: a selection made with the pointer down waits for it to come up, and opens
      // only if the element stayed where it was.
      let down = false;
      let waiting: (() => void) | null = null;
      const press = () => {
        down = true;
        waiting = null;
      };
      const release = () => {
        down = false;
        const open = waiting;
        waiting = null;
        // After the canvas has handled the release, a drag included.
        if (open) setTimeout(open, 0);
      };
      window.addEventListener("pointerdown", press, true);
      window.addEventListener("pointerup", release, true);
      window.addEventListener("pointercancel", release, true);
      const positionOf = (id: string | undefined) => {
        const at = id
          ? api.getDiagram(undefined, BASE)?.components.find((c) => c.id === id)?.position
          : null;
        return at ? `${at.x},${at.y}` : "";
      };
      const stop = api.canvas.onSelectionChange(({ componentIds, connectionId }) => {
        const binding = bindingRef.current?.state;
        const sources = projectionRef.current?.sources;
        if (!binding || !sources || api.getActiveDiagramId() !== diagramId) return;
        const keyOf = (ids: Record<string, string>, id: string) =>
          Object.entries(ids).find(([, v]) => v === id)?.[0];
        const key = connectionId
          ? keyOf(binding.connections, connectionId)
          : componentIds.length === 1
            ? keyOf(binding.ids, componentIds[0]!)
            : undefined;
        if (!key) {
          // Nothing (or several) selected: the next selection of that element opens it again.
          if (componentIds.length === 0 && !connectionId) pointed.current = null;
          return;
        }
        const element: GraphElementRef = { kind: connectionId ? "connection" : "component", key };
        const at = sources.locate(element);
        if (!at || sameElement(element, pointed.current)) return;
        const open = () => {
          pointed.current = element;
          showSource(at);
        };
        if (!down) return open();
        const id = connectionId ? undefined : componentIds[0];
        const before = positionOf(id);
        waiting = () => {
          if (positionOf(id) === before && !sameElement(element, pointed.current)) open();
        };
      });
      return () => {
        stop();
        window.removeEventListener("pointerdown", press, true);
        window.removeEventListener("pointerup", release, true);
        window.removeEventListener("pointercancel", release, true);
      };
    }, [folder, diagramId, showSource]);

    const cursorAt = useCallback((line: number) => {
      const file = selectedRef.current;
      const binding = bindingRef.current?.state;
      const sources = projectionRef.current?.sources;
      if (!file || !binding || !sources) return;
      const element = sources.elementAt(file, line);
      if (sameElement(element, pointed.current)) return;
      pointed.current = element;
      const id =
        element && (element.kind === "component" ? binding.ids : binding.connections)[element.key];
      if (!element || !id) api.canvas.highlight({});
      else if (element.kind === "component") api.canvas.highlight({ componentIds: [id] });
      else api.canvas.highlight({ connectionIds: [id] });
    }, []);

    // F2 in the editor: rename an element (its manifest or an edge end naming it) across every
    // file, keeping its canvas id — the same rename a canvas edit makes, started from the text.
    const renameSymbol = useMemo<PluginEditorRename>(
      () => ({
        resolve(offset) {
          const file = selectedRef.current;
          const at = file ? nameAt(manifestsOf(buffersRef.current), file, offset) : null;
          return at && { start: at.start, end: at.end, text: at.ref.name };
        },
        async rename(offset, newName) {
          const file = selectedRef.current;
          if (!file) return t.renameGone;
          const outcome = await engine.rename(file, offset, newName);
          return outcome === "gone"
            ? t.renameGone
            : outcome === "refused"
              ? t.renameRefused(newName.trim())
              : undefined;
        },
      }),
      [engine, t],
    );

    // While the folder is open, the chat context (API 1.6) reads and edits these buffers.
    useEffect(() => {
      if (!folder || !diagramId) return;
      return openSession({
        diagramId,
        folderName: folder.name,
        manifests: () => manifestsOf(buffersRef.current),
        config: () => {
          const config = buffersRef.current.find((b) => b.name === CONFIG_FILE);
          return config && { name: config.name, text: config.text };
        },
        apply: (files, touched) => engine.applyFiles(files, touched),
      });
    }, [folder, diagramId, engine]);

    // Changes made to the folder outside Structura (another editor, git): clean files reload and
    // the canvas follows; a file with unsaved edits keeps them and shows a conflict instead.
    const checking = useRef(false);
    const checkFolder = useCallback(async () => {
      if (!folder || checking.current || document.hidden) return;
      checking.current = true;
      try {
        const stats = await folder.stats();
        const { read, removed } = changedFiles(knownStats.current, stats, isTracked);
        if (read.length === 0 && removed.length === 0) return;
        const disk = Object.fromEntries(
          await Promise.all(read.map(async (name) => [name, await folder.read(name)] as const)),
        );
        knownStats.current = toStats(stats.filter((f) => isTracked(f.name)));
        const merged = mergeDisk(buffersRef.current, disk, removed, isSidecar);
        commitBuffers(merged.buffers);
        if (merged.conflicts.length > 0) setStatus(t.diskConflict(merged.conflicts));
        else if (merged.reloaded.length > 0) setStatus(t.diskReloaded(merged.reloaded));
        const sidecar = merged.reloaded.includes(LAYOUT_FILE)
          ? merged.buffers.find((b) => b.name === LAYOUT_FILE)?.text
          : undefined;
        const visualChanged = merged.reloaded.includes(VISUAL_FILE);
        const manifestsChanged = merged.reloaded.some((n) => !isSidecar(n));
        if (!sidecar && !visualChanged && !manifestsChanged) return;
        if (sidecar) await engine.sidecarChanged(sidecar);
        if (sidecar) await viewDiagrams.sidecarChanged(sidecar);
        if (visualChanged) await engine.visualChanged();
        if (!sidecar && !visualChanged) await engine.sync();
      } catch (error) {
        console.error("[opscr] checking the folder failed:", error);
      } finally {
        checking.current = false;
      }
    }, [folder, engine, t, commitBuffers, viewDiagrams]);

    useEffect(() => {
      if (!folder) return;
      const timer = setInterval(() => void checkFolder(), WATCH_INTERVAL_MS);
      const onFocus = () => void checkFolder();
      window.addEventListener("focus", onFocus);
      return () => {
        clearInterval(timer);
        window.removeEventListener("focus", onFocus);
      };
    }, [folder, checkFolder]);

    /**
     * The canvas's components, read once per render while some are outside the YAML: the pane
     * renders on every keystroke, and each read is a copy of the whole diagram.
     */
    const outsideComponents = new Map(
      outside.length > 0
        ? (api.getDiagram(undefined, BASE)?.components.map((c) => [c.id, c]) ?? [])
        : [],
    );

    /** The Kind/provider shown for an element outside the YAML: the user's pick, else a guess. */
    const pickFor = (id: string): { kind: string; provider: string } => {
      if (picks[id]) return picks[id]!;
      const byId = outsideComponents;
      const component = byId.get(id);
      if (!component) return { kind: "", provider: "" };
      const parent = component.parentId ? byId.get(component.parentId) : undefined;
      const parentKey = parent
        ? Object.entries(bindingRef.current?.state.ids ?? {}).find(([, v]) => v === parent.id)?.[0]
        : undefined;
      const parentKind = parentKey
        ? refOf(parentKey).kind
        : parent?.type === "panel"
          ? (kindFor({ type: "panel" })?.kind ?? null)
          : null;
      const guess = kindFor(
        {
          type: component.type,
          catalogServiceId: component.cloudServiceId,
          technology: component.technology,
        },
        parentKind,
      );
      return { kind: guess?.kind ?? "", provider: guess?.provider ?? "" };
    };

    /** Writes the chosen elements (and any panel they sit in that is outside too) into the YAML. */
    const addToYaml = (ids: readonly string[]) => {
      const diagram = api.getDiagram(undefined, BASE);
      if (!diagram || diagram.id !== diagramId) return;
      const bound = new Set(Object.values(bindingRef.current?.state.ids ?? {}));
      const parentOf = new Map(diagram.components.map((c) => [c.id, c.parentId]));
      const wanted = new Set<string>();
      for (const id of ids) {
        for (let at: string | null | undefined = id; at && !bound.has(at); at = parentOf.get(at)) {
          wanted.add(at);
        }
      }
      const choices: AddChoice[] = [...wanted].flatMap((id) => {
        const { kind, provider } = pickFor(id);
        return kind ? [{ id, kind, ...(provider ? { provider } : {}) }] : [];
      });
      return engine.addToYaml(choices);
    };

    const resolve = (name: string, side: "disk" | "mine") => {
      if (comparing === name) setComparing(null);
      commitBuffers(
        buffersRef.current.map((b) => (b.name === name ? resolveConflict(b, side) : b)),
      );
      if (side === "disk") void sync();
    };

    const load = useCallback(
      async (opened: PluginFolder) => {
        const listed = await opened.list();
        const names = listed.filter((n) => isManifest(n) || n === CONFIG_FILE);
        // The visual layer only exists for folders imported from draw.io.
        const sidecars = [
          LAYOUT_FILE,
          ...[VISUAL_FILE, ANALYSIS_FILE].filter((n) => listed.includes(n)),
        ];
        const loaded = await Promise.all(
          [...names, ...sidecars].map(async (name) => {
            // The layout sidecar may not exist yet: it is created on the first save.
            const content =
              name === LAYOUT_FILE && !listed.includes(name) ? "" : await opened.read(name);
            return { name, disk: content, text: content };
          }),
        );
        knownStats.current = toStats(await opened.stats());
        engine.reset();
        setFolder(opened);
        commitBuffers(loaded);
        setSelected((previous) =>
          previous && names.includes(previous) ? previous : (names.find(isManifest) ?? null),
        );
        await sync();
      },
      [engine, sync, commitBuffers],
    );

    const bind = async () => {
      if (!diagramId) return;
      const picked = await api.files.pick(diagramId);
      if (!picked) return;
      await persist({
        folderName: picked.name,
        state: bindingRef.current?.state ?? emptyBinding(),
      });
      await load(picked);
    };

    const reconnect = async () => {
      if (!diagramId) return;
      const opened = await api.files.open(diagramId);
      if (opened) await load(opened);
      else setStatus(t.permissionDenied);
    };

    const unbind = async () => {
      if (!diagramId) return;
      sessions.delete(diagramId);
      await api.files.forget(diagramId);
      await bindings.write(diagramId, () => api.storage.remove(storageKey(diagramId)));
      bindingRef.current = null;
      setStored(null);
      setFolder(null);
      commitBuffers([]);
      setSelected(null);
    };

    const edit = (value: string) => {
      commitBuffers(
        buffersRef.current.map((b) => (b.name === selected ? { ...b, text: value } : b)),
      );
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void sync(), SYNC_DELAY_MS);
    };

    const save = async () => {
      if (!folder) return;
      // What is written, as of now: text typed while the writes run stays unsaved.
      const written = new Map(
        buffersRef.current.filter((b) => b.text !== b.disk).map((b) => [b.name, b.text]),
      );
      for (const [name, text] of written) await folder.write(name, text);
      // Our own writes are not outside changes.
      const stats = toStats(await folder.stats());
      for (const name of written.keys()) if (stats[name]) knownStats.current[name] = stats[name]!;
      // The file on disk is now this text: any conflict with an older disk text is settled.
      const settle = (b: Buffer): Buffer =>
        written.has(b.name) ? { ...b, disk: written.get(b.name)!, conflict: undefined } : b;
      commitBuffers(buffersRef.current.map(settle));
      setStatus(t.saved(written.size));
    };

    /** An empty folder starts with one manifest, unsaved, to copy from. */
    const createFirst = async () => {
      const { name, text } = FIRST_MANIFEST;
      setTexts([{ name, text }]);
      setSelected(name);
      await sync();
      // Where it was drawn: an empty canvas may be looking anywhere.
      const id = bindingRef.current?.state.ids[FIRST_MANIFEST.key];
      if (id) api.canvas.highlight({ componentIds: [id] });
    };

    const reload = async () => {
      if (folder) await load(folder);
    };

    /** A one-way migration: only into a folder that holds no opscr workspace yet. */
    const importDrawioIntoFolder = async (file: File) => {
      if (!folder) return;
      const listed = await folder.list();
      if (listed.some(isWorkspaceFile)) return setStatus(t.importNeedsEmpty);
      setStatus(t.importing(file.name));
      const result = await importDrawioFile(await file.text(), file.name);
      if (result.problem) return setStatus(t.importProblem(result.problem));
      for (const f of result.files) await folder.write(f.name, f.text);
      await load(folder);
      setStatus(t.imported(file.name, result.skippedPages));
    };

    useEffect(() => () => clearTimeout(timer.current), []);

    if (!diagramId) {
      return <p className="px-4 py-4 text-sm text-muted-foreground">{t.noDiagram}</p>;
    }

    if (!stored) {
      return (
        <div className="space-y-3 px-4 py-4">
          <p className="text-sm text-muted-foreground">{t.intro}</p>
          {api.files.isSupported() ? (
            <button
              type="button"
              className={`${PRIMARY_BUTTON_CLASS} w-full`}
              onClick={() => void bind()}
            >
              <Icon path={FOLDER} />
              {t.bind}
            </button>
          ) : (
            <p className="text-sm text-destructive">{t.unsupported}</p>
          )}
        </div>
      );
    }

    if (!folder) {
      return (
        <div className="space-y-3 px-4 py-4">
          <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2.5 text-sm">
            <Icon path={FOLDER} className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="min-w-0 flex-1">{t.boundTo(stored.folderName)}</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`${PRIMARY_BUTTON_CLASS} flex-1`}
              onClick={() => void reconnect()}
            >
              {t.reconnect}
            </button>
            <button type="button" className={BUTTON_CLASS} onClick={() => void unbind()}>
              <Icon path={UNLINK} />
              {t.unbind}
            </button>
          </div>
          {status && <p className="text-xs text-muted-foreground">{status}</p>}
        </div>
      );
    }

    const current = buffers.find((b) => b.name === selected);
    const dirtyCount = buffers.filter((b) => b.text !== b.disk).length;
    const problemsHere = diagnostics.filter((d) => d.file === selected);
    const problemsElsewhere = diagnostics.filter(
      (d) => d.file !== selected && d.severity === "error",
    ).length;
    const omitted = projection?.omitted ?? [];
    const dropped = projection?.dropped ?? [];
    const notCarried = unwritten.length + omitted.length + dropped.length + drawnThrough.length;
    const sources = buffers.map((b) => ({ name: b.name, text: b.text }));
    const review = buffers.some((b) => b.name === ANALYSIS_FILE) ? reviewItems(sources) : [];
    const flaggedPages = notArchitecturePages(sources);
    const openWritten = (id: string) => {
      const at = projection?.sources?.locateWritten(id);
      if (at) showSource(at);
    };
    const files = buffers.filter((b) => !isSidecar(b.name));

    return (
      <div className="flex h-full min-h-0 flex-col text-sm">
        <div className="flex shrink-0 items-center gap-1 border-b border-border py-2 pl-4 pr-2">
          <Icon path={FOLDER} className="h-4 w-4 shrink-0 text-muted-foreground" />
          <span className="ml-1 min-w-0 truncate font-medium" title={stored.folderName}>
            {stored.folderName}
          </span>
          {dirtyCount > 0 && (
            <span className="shrink-0 rounded-full bg-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              {t.unsaved(dirtyCount)}
            </span>
          )}
          <span className="flex-1" />
          <button
            type="button"
            className={`${PRIMARY_BUTTON_CLASS} h-7 px-2.5`}
            disabled={dirtyCount === 0}
            onClick={() => void save()}
          >
            <Icon path={SAVE} />
            {t.save}
          </button>
          <button
            type="button"
            className={ICON_BUTTON_CLASS}
            onClick={() => void reload()}
            aria-label={t.reload}
            title={dirtyCount > 0 ? `${t.reload} — ${t.reloadDiscards}` : t.reload}
          >
            <Icon path={RELOAD} />
          </button>
          <button
            type="button"
            className={ICON_BUTTON_CLASS}
            onClick={() => void unbind()}
            aria-label={t.unbind}
            title={t.unbind}
          >
            <Icon path={UNLINK} />
          </button>
        </div>
        {buffers
          .filter((b) => b.conflict !== undefined)
          .map((b) => (
            <div
              key={`conflict-${b.name}`}
              role="alert"
              className="shrink-0 space-y-2 border-b border-border bg-amber-500/10 px-4 py-2.5 text-xs"
            >
              <p className="text-amber-700 dark:text-amber-400">{t.conflictBanner(b.name)}</p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  className={`${BUTTON_CLASS} h-7`}
                  aria-pressed={comparing === b.name}
                  onClick={() => {
                    setSelected(b.name);
                    setComparing((c) => (c === b.name ? null : b.name));
                  }}
                >
                  {comparing === b.name ? t.closeCompare : t.compare}
                </button>
                <button
                  type="button"
                  className={`${BUTTON_CLASS} h-7`}
                  onClick={() => resolve(b.name, "disk")}
                >
                  {t.useDisk}
                </button>
                <button
                  type="button"
                  className={`${BUTTON_CLASS} h-7`}
                  onClick={() => resolve(b.name, "mine")}
                >
                  {t.keepMine}
                </button>
              </div>
            </div>
          ))}
        {/* The sections share at most half the pane: the editor keeps the rest. */}
        <div className="max-h-[50%] shrink-0 overflow-y-auto empty:hidden">
          {views.names.length > 0 && (
            <Section title={t.viewSection}>
              <div>
                <label htmlFor={`opscr-view-${diagramId}`} className={LABEL_CLASS}>
                  {t.viewLabel}
                </label>
                <select
                  id={`opscr-view-${diagramId}`}
                  aria-label={t.viewLabel}
                  className={SELECT_CLASS}
                  value={stored.state.view ?? ""}
                  onChange={(e) => void engine.showView(e.target.value || undefined)}
                >
                  <option value="">{t.wholeWorkspace}</option>
                  {[...views.names].sort().map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
                {stored.state.view !== undefined && (
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{t.viewReadOnly}</p>
                )}
              </div>
              {views.links.length > 0 && (
                <div>
                  <span className={LABEL_CLASS}>{t.opensTitle}</span>
                  <ul className="flex flex-wrap gap-1.5">
                    {views.links.map((link) => (
                      <li key={link.key}>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-xs text-foreground hover:bg-accent"
                          title={t.opensTitle}
                          aria-label={t.opens(link.name, link.view)}
                          onClick={() => void engine.showView(link.view)}
                        >
                          {link.name}
                          <Icon path={ARROW_RIGHT} className="h-3 w-3 text-muted-foreground" />
                          {link.view}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <label className="flex cursor-pointer items-start gap-3 rounded-md border border-border bg-secondary/40 px-3 py-2.5">
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium">{t.viewDiagrams}</span>
                  <span className="mt-0.5 block text-[11px] text-muted-foreground">
                    {t.viewDiagramsHint}
                  </span>
                </span>
                <input
                  type="checkbox"
                  className="mt-1 h-4 w-4 shrink-0 accent-primary"
                  checked={viewDiagrams.enabled}
                  onChange={(e) => viewDiagrams.setEnabled(e.target.checked)}
                />
              </label>
              {viewDiagrams.enabled && viewDiagrams.report.diagrams.length > 0 && (
                <p className="text-[11px] text-muted-foreground">
                  {t.viewDiagramsMade(viewDiagrams.report.diagrams.length)}:{" "}
                  {viewDiagrams.report.diagrams.map((d) => d.name).join(" · ")}
                </p>
              )}
              {viewDiagrams.enabled && viewDiagrams.report.orphans.length > 0 && (
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  {t.viewDiagramsOrphans(viewDiagrams.report.orphans.map((o) => o.view).join(", "))}
                </p>
              )}
            </Section>
          )}
          {outside.length > 0 && stored.state.view !== undefined && (
            // A view does not add to the YAML: say so, and offer the whole workspace, where the
            // element is kept and can be added.
            <Section title={t.outsideTitle(outside.length)}>
              <p className="text-xs text-amber-700 dark:text-amber-400">{t.outsideInView}</p>
              <ul className="flex flex-wrap gap-1.5">
                {outside.map((id) => {
                  const label = outsideComponents.get(id)?.label;
                  return label ? (
                    <li
                      key={id}
                      className="rounded-full border border-border bg-secondary/40 px-2 py-0.5 text-xs"
                    >
                      {label}
                    </li>
                  ) : null;
                })}
              </ul>
              <button
                type="button"
                className={`${PRIMARY_BUTTON_CLASS} w-full`}
                onClick={() => void engine.showView(undefined)}
              >
                {t.showWholeToAdd}
              </button>
            </Section>
          )}
          {outside.length > 0 && stored.state.view === undefined && (
            <Section title={t.outsideTitle(outside.length)}>
              <ul className="space-y-2">
                {outside.map((id) => {
                  const component = outsideComponents.get(id);
                  if (!component) return null;
                  const pick = pickFor(id);
                  const providers = providersFor(pick.kind);
                  const setPick = (next: Partial<typeof pick>) =>
                    setPicks((all) => ({ ...all, [id]: { ...pick, ...next } }));
                  return (
                    <li
                      key={id}
                      className="space-y-2 rounded-md border border-border bg-secondary/40 p-2.5"
                    >
                      <div className="flex items-center gap-2">
                        <span
                          className="min-w-0 flex-1 truncate font-medium"
                          title={component.label}
                        >
                          {component.label}
                        </span>
                        <button
                          type="button"
                          className={`${BUTTON_CLASS} h-7 px-2`}
                          disabled={!pick.kind}
                          onClick={() => void addToYaml([id])}
                        >
                          <Icon path={PLUS} />
                          {t.addToYaml}
                        </button>
                      </div>
                      <div className={`grid gap-2 ${providers.length > 0 ? "grid-cols-2" : ""}`}>
                        <select
                          aria-label={t.kindFor(component.label)}
                          className={SELECT_CLASS}
                          value={pick.kind}
                          onChange={(e) => setPick({ kind: e.target.value, provider: "" })}
                        >
                          <option value="">{t.pickKind}</option>
                          {DRAWN_KINDS.map((kind) => (
                            <option key={kind} value={kind}>
                              {kind}
                            </option>
                          ))}
                        </select>
                        {providers.length > 0 && (
                          <select
                            aria-label={t.providerFor(component.label)}
                            className={SELECT_CLASS}
                            value={pick.provider}
                            onChange={(e) => setPick({ provider: e.target.value })}
                          >
                            <option value="">{t.noProvider}</option>
                            {pick.provider && !providers.includes(pick.provider) && (
                              <option value={pick.provider}>{pick.provider}</option>
                            )}
                            {providers.map((provider) => (
                              <option key={provider} value={provider}>
                                {provider}
                              </option>
                            ))}
                          </select>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
              {outside.length > 1 && (
                <button
                  type="button"
                  className={`${BUTTON_CLASS} w-full`}
                  onClick={() => void addToYaml(outside)}
                >
                  <Icon path={PLUS} />
                  {t.addAllToYaml}
                </button>
              )}
            </Section>
          )}
          {notCarried > 0 && (
            // Open when something needs a look: a canvas edit the YAML does not carry, or an edge
            // the YAML gets wrong — not for Kinds and edges this view leaves out by design.
            <Section
              title={t.notCarriedTitle(notCarried)}
              defaultOpen={unwritten.length > 0 || dropped.some((d) => d.reason !== "not-drawn")}
            >
              {unwritten.length > 0 && (
                <div>
                  <span className={LABEL_CLASS}>{t.onCanvasOnly}</span>
                  <ul>
                    {unwritten.map((u) => (
                      <li key={`${u.id}-${u.reason}`}>
                        <button
                          type="button"
                          className={LINK_ROW_CLASS}
                          onClick={() => api.canvas.highlight({ connectionIds: [u.id] })}
                        >
                          {t.unwritten(u.reason, u.label, u.type)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {omitted.length + dropped.length + drawnThrough.length > 0 && (
                <div>
                  <span className={LABEL_CLASS}>{t.inYamlOnly}</span>
                  <ul>
                    {dropped.map((d) => (
                      <li key={`${d.relationship}#${d.index}`}>
                        <button
                          type="button"
                          className={LINK_ROW_CLASS}
                          onClick={() => openWritten(`${d.relationship}#${d.index}`)}
                        >
                          {t.dropped(d.type, d.from, d.to, d.reason)}
                        </button>
                      </li>
                    ))}
                    {drawnThrough.map((d) => (
                      <li key={`through:${d.edge}`}>
                        <button
                          type="button"
                          className={LINK_ROW_CLASS}
                          onClick={() => openWritten(d.edge.split(" -")[0]!)}
                        >
                          {t.drawnThrough(d.edge, d.via)}
                        </button>
                      </li>
                    ))}
                    {omitted.map((o) => (
                      <li key={`${o.kind}/${o.name}`}>
                        <button
                          type="button"
                          className={LINK_ROW_CLASS}
                          onClick={() => openWritten(`${o.kind}/${o.name}`)}
                        >
                          {t.omitted(o.kind, o.name)}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </Section>
          )}
          {review.length + flaggedPages.length > 0 && (
            <Section title={t.reviewTitle(review.length)} defaultOpen={false}>
              {flaggedPages.length > 0 && (
                <p className="text-xs text-destructive">{t.notArchitecture(flaggedPages)}</p>
              )}
              <ul>
                {review.map((r) => (
                  <li key={r.key}>
                    <button
                      type="button"
                      className={LINK_ROW_CLASS}
                      onClick={() => openWritten(r.key)}
                      title={r.evidence}
                    >
                      <span className="font-medium">{r.key}</span>
                      <span className="text-muted-foreground"> — {r.evidence}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
        {files.length > 0 && (
          <div
            role="tablist"
            className="flex shrink-0 overflow-x-auto border-b border-border bg-secondary/40 px-2"
          >
            {files.map((b) => (
              <button
                key={b.name}
                type="button"
                role="tab"
                aria-selected={b.name === selected}
                title={b.name}
                onClick={() => setSelected(b.name)}
                className={`-mb-px shrink-0 whitespace-nowrap border-b-2 px-2.5 py-2 text-xs transition-colors ${
                  b.name === selected
                    ? "border-primary font-medium text-foreground"
                    : "border-transparent text-muted-foreground hover:text-foreground"
                }`}
              >
                {b.name}
                {b.conflict !== undefined ? " ⚠" : b.text !== b.disk ? " •" : ""}
              </button>
            ))}
          </div>
        )}
        {current && comparing === current.name && current.conflict !== undefined && (
          <p className="shrink-0 border-b border-border px-4 py-2 text-xs text-muted-foreground">
            {t.compareHint}
          </p>
        )}
        <div className="min-h-0 flex-1">
          {current ? (
            <CodeEditor
              // A model per file: each keeps its own undo history, cursor and scroll.
              path={`structura-plugin-opscr/${diagramId}/${current.name}`}
              value={current.text}
              language="yaml"
              onChange={edit}
              onSave={() => void save()}
              rename={renameSymbol}
              markers={problemsHere.map(toMarker)}
              revealLine={reveal}
              onCursorLine={cursorAt}
              {...(comparing === current.name && current.conflict !== undefined
                ? { original: current.conflict }
                : {})}
            />
          ) : (
            !buffers.some((b) => isManifest(b.name)) && (
              <div className="space-y-3 px-4 py-4">
                <p className="text-sm text-muted-foreground">{t.emptyFolder}</p>
                <button
                  type="button"
                  className={`${PRIMARY_BUTTON_CLASS} w-full`}
                  onClick={() => void createFirst()}
                >
                  <Icon path={FILE_PLUS} />
                  {t.createFirst}
                </button>
                <label className={`${BUTTON_CLASS} w-full cursor-pointer`}>
                  <Icon path={UPLOAD} />
                  {t.importDrawio}
                  <input
                    type="file"
                    accept=".drawio,.xml,.svg"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = "";
                      if (file) void importDrawioIntoFolder(file);
                    }}
                  />
                </label>
                <p className="text-[11px] text-muted-foreground">{t.importDrawioHint}</p>
              </div>
            )
          )}
        </div>
        <div
          className="flex shrink-0 items-center gap-2 border-t border-border px-4 py-1.5 text-[11px] text-muted-foreground"
          aria-live="polite"
        >
          <span
            aria-hidden
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${
              failed ? "bg-destructive" : problemsElsewhere > 0 ? "bg-amber-500" : "bg-emerald-500"
            }`}
          />
          <span className="min-w-0 flex-1 truncate" title={status}>
            {failed ? (
              <>
                {t.syncFailed}{" "}
                <button type="button" className="underline" onClick={() => void sync()}>
                  {t.retrySync}
                </button>
              </>
            ) : (
              status
            )}
            {problemsElsewhere > 0 ? ` · ${t.problemsElsewhere(problemsElsewhere)}` : ""}
          </span>
        </div>
      </div>
    );
  };
}
