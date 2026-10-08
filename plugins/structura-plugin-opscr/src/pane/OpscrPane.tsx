import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Diagnostic } from "opscr/core";
import type {
  PluginEditorMarker,
  PluginEditorRename,
  PluginFolder,
  PluginPanelProps,
  StructuraPluginApi,
} from "../types/plugin.types";
import { CONFIG_FILE, isManifest, projector } from "../project";
import { nameAt, refOf, type SourceText } from "../engine/patches";
import { openSession } from "../session";
import { DRAWN_KINDS, LAYOUT_FILE, kindFor, providersFor } from "../generated/opscr-mapping";
import type { AddChoice } from "../engine/adopt";
import { OpscrEngine, type EngineEvent } from "../engine/engine";
import { emptyBinding, type BindingState } from "../engine/sync";
import { changedFiles, mergeDisk, resolveConflict, toStats, type Stats } from "../engine/watch";
import { text, type Locale } from "./i18n";

const SYNC_DELAY_MS = 300;

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
  isManifest(name) || name === CONFIG_FILE || name === LAYOUT_FILE;

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

  return function OpscrPane({ context }: PluginPanelProps) {
    const t = useMemo(() => text(context.locale as Locale), [context.locale]);
    const [diagramId, setDiagramId] = useState(() => api.getActiveDiagramId());
    const [stored, setStored] = useState<StoredBinding | null>(null);
    const [folder, setFolder] = useState<PluginFolder | null>(null);
    const [buffers, setBuffers] = useState<Buffer[]>([]);
    const [selected, setSelected] = useState<string | null>(null);
    const selectedRef = useRef(selected);
    selectedRef.current = selected;
    const [diagnostics, setDiagnostics] = useState<Diagnostic[]>([]);
    const [status, setStatus] = useState<string>("");
    /** Canvas elements the YAML does not declare, and the Kind/provider picked for each. */
    const [outside, setOutside] = useState<string[]>([]);
    const [picks, setPicks] = useState<Record<string, { kind: string; provider: string }>>({});
    const bindingRef = useRef<StoredBinding | null>(null);
    const buffersRef = useRef<Buffer[]>([]);
    buffersRef.current = buffers;
    const timer = useRef<ReturnType<typeof setTimeout>>();
    /** The folder's file stats as of the last read or save, to notice outside changes. */
    const knownStats = useRef<Stats>({});

    // Follow the active diagram.
    useEffect(() => api.onDiagramChange(() => setDiagramId(api.getActiveDiagramId())), []);

    // Load what the plugin remembers about this diagram; the folder needs a user gesture.
    useEffect(() => {
      setFolder(null);
      setBuffers([]);
      setSelected(null);
      setDiagnostics([]);
      if (!diagramId) return setStored(null);
      void api.storage.get<StoredBinding>(storageKey(diagramId)).then((value) => {
        bindingRef.current = value;
        setStored(value);
      });
    }, [diagramId]);

    const persist = useCallback(
      async (binding: StoredBinding) => {
        if (!diagramId) return;
        bindingRef.current = binding;
        setStored(binding);
        await api.storage.set(storageKey(diagramId), binding);
      },
      [diagramId],
    );

    /** New texts for the buffers; names the folder does not have yet become new, unsaved files. */
    const setTexts = useCallback((files: readonly SourceText[]) => {
      const byName = new Map(files.map((f) => [f.name, f.text]));
      const known = new Set(buffersRef.current.map((b) => b.name));
      const next = [
        ...buffersRef.current.map((b) => ({ ...b, text: byName.get(b.name) ?? b.text })),
        ...files
          .filter((f) => !known.has(f.name))
          .map((f) => ({ name: f.name, disk: "", text: f.text })),
      ];
      buffersRef.current = next;
      setBuffers(next);
    }, []);

    // The binding engine over this pane's buffers, the active diagram and the plugin storage.
    const onEvent = useRef<(event: EngineEvent) => void>(() => {});
    onEvent.current = (event) => {
      if (event.type === "synced") setStatus(t.synced(event.elements));
      else if (event.type === "parse-error" || event.type === "invalid") setStatus(t.parseError);
      else if (event.type === "diagnostics") setDiagnostics(event.diagnostics as Diagnostic[]);
      else if (event.type === "outside") setOutside(event.ids);
      else if (event.type === "rename-refused") setStatus(t.renameRefused(event.name));
      else if (event.type === "provider-refused") setStatus(t.providerRefused(event.names));
      else setStatus(t.addedToYaml(event.keys));
    };
    const engine = useMemo(
      () =>
        new OpscrEngine({
          texts: {
            get: () => buffersRef.current.map((b) => ({ name: b.name, text: b.text })),
            set: (files) => setTexts(files),
          },
          diagram: {
            get: () => {
              const diagram = api.getDiagram();
              return diagram && diagram.id === diagramId ? diagram : null;
            },
            apply: (changes) => api.applyChanges(changes),
          },
          binding: {
            get: () => bindingRef.current?.state ?? emptyBinding(),
            set: (state) =>
              bindingRef.current ? persist({ ...bindingRef.current, state }) : undefined,
          },
          project: projector,
          isManifest,
          configFile: CONFIG_FILE,
          onEvent: (event) => onEvent.current(event),
        }),
      [diagramId, persist, setTexts],
    );

    const sync = useCallback(() => engine.sync(), [engine]);

    // Canvas edits (and undo/redo) of the bound diagram reach the YAML while the folder is open.
    useEffect(() => {
      if (!folder || !diagramId) return;
      return api.onDiagramChange((changed) => {
        if (changed === diagramId) void engine.canvasChanged();
      });
    }, [folder, diagramId, engine]);

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
        const merged = mergeDisk(buffersRef.current, disk, removed, (n) => n === LAYOUT_FILE);
        buffersRef.current = merged.buffers;
        setBuffers(merged.buffers);
        if (merged.conflicts.length > 0) setStatus(t.diskConflict(merged.conflicts));
        else if (merged.reloaded.length > 0) setStatus(t.diskReloaded(merged.reloaded));
        const sidecar = merged.reloaded.includes(LAYOUT_FILE)
          ? merged.buffers.find((b) => b.name === LAYOUT_FILE)?.text
          : undefined;
        const manifestsChanged = merged.reloaded.some((n) => n !== LAYOUT_FILE);
        if (!sidecar && !manifestsChanged) return;
        if (sidecar) await engine.sidecarChanged(sidecar);
        else await engine.sync();
      } catch (error) {
        console.error("[opscr] checking the folder failed:", error);
      } finally {
        checking.current = false;
      }
    }, [folder, engine, t]);

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

    /** The Kind/provider shown for an element outside the YAML: the user's pick, else a guess. */
    const pickFor = (id: string): { kind: string; provider: string } => {
      if (picks[id]) return picks[id]!;
      const diagram = api.getDiagram();
      const byId = new Map(diagram?.components.map((c) => [c.id, c]) ?? []);
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
      const diagram = api.getDiagram();
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
      const next = buffersRef.current.map((b) => (b.name === name ? resolveConflict(b, side) : b));
      buffersRef.current = next;
      setBuffers(next);
      if (side === "disk") void sync();
    };

    const load = useCallback(
      async (opened: PluginFolder) => {
        const listed = await opened.list();
        const names = listed.filter((n) => isManifest(n) || n === CONFIG_FILE);
        const loaded = await Promise.all(
          [...names, LAYOUT_FILE].map(async (name) => {
            // The sidecar may not exist yet: it is created on the first save.
            const content =
              name === LAYOUT_FILE && !listed.includes(name) ? "" : await opened.read(name);
            return { name, disk: content, text: content };
          }),
        );
        knownStats.current = toStats(await opened.stats());
        engine.reset();
        buffersRef.current = loaded;
        setFolder(opened);
        setBuffers(loaded);
        setSelected((previous) =>
          previous && names.includes(previous) ? previous : (names.find(isManifest) ?? null),
        );
        await sync();
      },
      [engine, sync],
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
      await api.files.forget(diagramId);
      await api.storage.remove(storageKey(diagramId));
      bindingRef.current = null;
      setStored(null);
      setFolder(null);
      setBuffers([]);
      setSelected(null);
    };

    const edit = (value: string) => {
      setBuffers((list) => list.map((b) => (b.name === selected ? { ...b, text: value } : b)));
      buffersRef.current = buffersRef.current.map((b) =>
        b.name === selected ? { ...b, text: value } : b,
      );
      clearTimeout(timer.current);
      timer.current = setTimeout(() => void sync(), SYNC_DELAY_MS);
    };

    const save = async () => {
      if (!folder) return;
      const dirty = buffersRef.current.filter((b) => b.text !== b.disk);
      for (const b of dirty) await folder.write(b.name, b.text);
      const saved = new Set(dirty.map((b) => b.name));
      // Our own writes are not outside changes.
      const stats = toStats(await folder.stats());
      for (const name of saved) if (stats[name]) knownStats.current[name] = stats[name]!;
      buffersRef.current = buffersRef.current.map((b) =>
        saved.has(b.name) ? { ...b, disk: b.text } : b,
      );
      setBuffers((list) => list.map((b) => (saved.has(b.name) ? { ...b, disk: b.text } : b)));
      setStatus(t.saved(dirty.length));
    };

    const reload = async () => {
      if (folder) await load(folder);
    };

    useEffect(() => () => clearTimeout(timer.current), []);

    if (!diagramId) return <p className="p-3 text-xs text-muted-foreground">{t.noDiagram}</p>;

    if (!stored) {
      return (
        <div className="space-y-2 p-3 text-xs">
          <p className="text-muted-foreground">{t.intro}</p>
          {api.files.isSupported() ? (
            <button
              type="button"
              className="rounded-md border px-3 py-1.5"
              onClick={() => void bind()}
            >
              {t.bind}
            </button>
          ) : (
            <p className="text-destructive">{t.unsupported}</p>
          )}
        </div>
      );
    }

    if (!folder) {
      return (
        <div className="space-y-2 p-3 text-xs">
          <p>{t.boundTo(stored.folderName)}</p>
          <button
            type="button"
            className="rounded-md border px-3 py-1.5"
            onClick={() => void reconnect()}
          >
            {t.reconnect}
          </button>
          <button
            type="button"
            className="ml-2 text-muted-foreground underline"
            onClick={() => void unbind()}
          >
            {t.unbind}
          </button>
          {status && <p className="text-muted-foreground">{status}</p>}
        </div>
      );
    }

    const current = buffers.find((b) => b.name === selected);
    const dirtyCount = buffers.filter((b) => b.text !== b.disk).length;
    const problemsHere = diagnostics.filter((d) => d.file === selected);
    const problemsElsewhere = diagnostics.filter(
      (d) => d.file !== selected && d.severity === "error",
    ).length;

    return (
      <div className="flex h-full min-h-0 flex-col text-xs">
        <div className="flex flex-wrap items-center gap-1 border-b px-2 py-1">
          <span className="mr-auto font-medium" title={stored.folderName}>
            {stored.folderName}
          </span>
          <button
            type="button"
            className="rounded border px-2 py-0.5 disabled:opacity-50"
            disabled={dirtyCount === 0}
            onClick={() => void save()}
          >
            {t.save}
          </button>
          <button
            type="button"
            className="rounded border px-2 py-0.5"
            onClick={() => void reload()}
            title={dirtyCount > 0 ? t.reloadDiscards : undefined}
          >
            {t.reload}
          </button>
          <button
            type="button"
            className="px-2 py-0.5 text-muted-foreground underline"
            onClick={() => void unbind()}
          >
            {t.unbind}
          </button>
        </div>
        <div role="tablist" className="flex flex-wrap gap-1 border-b px-2 py-1">
          {buffers
            .filter((b) => b.name !== LAYOUT_FILE)
            .map((b) => (
              <button
                key={b.name}
                type="button"
                role="tab"
                aria-selected={b.name === selected}
                onClick={() => setSelected(b.name)}
                className={`rounded px-2 py-0.5 ${b.name === selected ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              >
                {b.name}
                {b.conflict !== undefined ? " ⚠" : b.text !== b.disk ? " •" : ""}
              </button>
            ))}
        </div>
        {outside.length > 0 && (
          <details className="border-b px-2 py-1" open>
            <summary className="cursor-pointer">{t.outsideTitle(outside.length)}</summary>
            <div className="mt-1 space-y-1">
              {outside.map((id) => {
                const component = api.getDiagram()?.components.find((c) => c.id === id);
                if (!component) return null;
                const pick = pickFor(id);
                const providers = providersFor(pick.kind);
                const setPick = (next: Partial<typeof pick>) =>
                  setPicks((all) => ({ ...all, [id]: { ...pick, ...next } }));
                return (
                  <div key={id} className="flex flex-wrap items-center gap-1">
                    <span className="mr-auto truncate" title={component.label}>
                      {component.label}
                    </span>
                    <select
                      aria-label={t.kindFor(component.label)}
                      className="rounded border bg-background px-1 py-0.5"
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
                        className="rounded border bg-background px-1 py-0.5"
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
                    <button
                      type="button"
                      className="rounded border px-2 py-0.5 disabled:opacity-50"
                      disabled={!pick.kind}
                      onClick={() => void addToYaml([id])}
                    >
                      {t.addToYaml}
                    </button>
                  </div>
                );
              })}
              {outside.length > 1 && (
                <button
                  type="button"
                  className="rounded border px-2 py-0.5"
                  onClick={() => void addToYaml(outside)}
                >
                  {t.addAllToYaml}
                </button>
              )}
            </div>
          </details>
        )}
        {buffers
          .filter((b) => b.conflict !== undefined)
          .map((b) => (
            <div
              key={`conflict-${b.name}`}
              role="alert"
              className="flex flex-wrap items-center gap-2 border-b bg-amber-500/10 px-2 py-1"
            >
              <span className="mr-auto">{t.conflictBanner(b.name)}</span>
              <button
                type="button"
                className="rounded border px-2 py-0.5"
                onClick={() => resolve(b.name, "disk")}
              >
                {t.useDisk}
              </button>
              <button
                type="button"
                className="rounded border px-2 py-0.5"
                onClick={() => resolve(b.name, "mine")}
              >
                {t.keepMine}
              </button>
            </div>
          ))}
        <div className="min-h-0 flex-1">
          {current && (
            <CodeEditor
              value={current.text}
              language="yaml"
              onChange={edit}
              onSave={() => void save()}
              rename={renameSymbol}
              markers={problemsHere.map(toMarker)}
            />
          )}
        </div>
        <div className="border-t px-2 py-1 text-muted-foreground" aria-live="polite">
          {status}
          {problemsElsewhere > 0 ? ` · ${t.problemsElsewhere(problemsElsewhere)}` : ""}
        </div>
      </div>
    );
  };
}
