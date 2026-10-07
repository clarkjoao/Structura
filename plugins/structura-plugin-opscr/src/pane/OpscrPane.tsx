import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Diagnostic } from "opscr/core";
import type {
  PluginEditorMarker,
  PluginEditorRename,
  PluginFolder,
  PluginPanelProps,
  StructuraPluginApi,
} from "../types/plugin.types";
import { CONFIG_FILE, isManifest, projectWorkspace } from "../project";
import { keyOf, nameAt, renameElement, type SourceText } from "../patches";
import { reconcile, renameInBinding, retire } from "../reconcile";
import { openSession } from "../session";
import { LAYOUT_FILE } from "../generated/opscr-mapping";
import { emptyBinding, planSync, previousLayout, sidecarText, type BindingState } from "../sync";
import { text, type Locale } from "./i18n";

const SYNC_DELAY_MS = 300;

interface Buffer {
  name: string;
  /** Text on disk, as last read or saved. */
  disk: string;
  /** Text in the editor. */
  text: string;
}

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
    const [notInYaml, setNotInYaml] = useState(0);
    const bindingRef = useRef<StoredBinding | null>(null);
    const buffersRef = useRef<Buffer[]>([]);
    buffersRef.current = buffers;
    const timer = useRef<ReturnType<typeof setTimeout>>();
    const syncing = useRef<Promise<void>>(Promise.resolve());
    /** The manifests as of the last sync: the text a canvas undo of that sync brings back. */
    const synced = useRef<SourceText[]>([]);

    // Follow the active diagram.
    useEffect(() => api.onDiagramChange(() => setDiagramId(api.getActiveDiagramId())), []);

    // Load what the plugin remembers about this diagram; the folder needs a user gesture.
    useEffect(() => {
      setFolder(null);
      setBuffers([]);
      setSelected(null);
      setDiagnostics([]);
      synced.current = [];
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
    const setTexts = (files: readonly SourceText[]) => {
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
    };

    /** Canvas → YAML: patches the buffers with what was changed on the canvas. */
    const reconcileNow = useCallback(async (): Promise<boolean> => {
      const binding = bindingRef.current;
      const diagram = api.getDiagram();
      if (!binding || !diagram || diagram.id !== diagramId) return false;
      const result = reconcile(diagram, binding.state, manifestsOf(buffersRef.current));
      if (result.skipped) return false;
      if (result.changed) setTexts(result.files);
      await persist({ ...binding, state: result.binding });
      const { remove, disconnect, update } = result.revert;
      if (remove.length + disconnect.length + update.length > 0) api.applyChanges(result.revert);
      setNotInYaml(result.notInYaml);
      if (result.refused.length > 0) setStatus(t.renameRefused(result.refused[0]!));
      return result.changed;
    }, [diagramId, persist, t]);

    /** Rewrites the layout sidecar buffer from the canvas, when the arrangement changed. */
    const writeSidecar = useCallback(() => {
      const binding = bindingRef.current;
      const diagram = api.getDiagram();
      if (!binding || !diagram || diagram.id !== diagramId) return;
      const text = sidecarText(binding.state, diagram);
      const current = buffersRef.current.find((b) => b.name === LAYOUT_FILE);
      if (!current || current.text === text) return;
      const next = buffersRef.current.map((b) => (b.name === LAYOUT_FILE ? { ...b, text } : b));
      buffersRef.current = next;
      setBuffers(next);
    }, [diagramId]);

    /** YAML → canvas. */
    const syncNow = useCallback(async () => {
      const binding = bindingRef.current;
      const diagram = api.getDiagram();
      if (!binding || !diagram || diagram.id !== diagramId) return;
      const current = buffersRef.current;
      const manifests = manifestsOf(current);
      const config = current.find((b) => b.name === CONFIG_FILE);
      const projection = await projectWorkspace(
        manifests.map((f) => ({ path: f.name, content: f.text })),
        config ? { path: config.name, content: config.text } : undefined,
        previousLayout(binding.state, diagram, current.find((b) => b.name === LAYOUT_FILE)?.text),
      );
      setDiagnostics(projection.diagnostics);
      if (!projection.graph) return setStatus(t.parseError);
      const plan = planSync(projection.graph, binding.state, diagram);
      const result = plan.empty
        ? { idsByKey: {}, connectionIds: [] }
        : api.applyChanges(plan.changes);
      await persist({
        ...binding,
        state: retire(binding.state, plan.commit(result), synced.current),
      });
      synced.current = manifests;
      writeSidecar();
      setStatus(t.synced(projection.graph.components.length));
    }, [diagramId, persist, t, writeSidecar]);

    /** Runs after every queued step: canvas edits first, so a sync never takes them back. */
    const enqueue = useCallback((step: () => Promise<void>) => {
      syncing.current = syncing.current.then(step).catch((error: unknown) => {
        console.error("[opscr] sync failed:", error);
      });
      return syncing.current;
    }, []);

    const sync = useCallback(
      () =>
        enqueue(async () => {
          await reconcileNow();
          await syncNow();
        }),
      [enqueue, reconcileNow, syncNow],
    );

    // Canvas edits (and undo/redo) of the bound diagram reach the YAML while the folder is open.
    useEffect(() => {
      if (!folder || !diagramId) return;
      return api.onDiagramChange((changed) => {
        if (changed !== diagramId) return;
        void enqueue(async () => {
          if (await reconcileNow()) await syncNow();
          else writeSidecar();
        });
      });
    }, [folder, diagramId, enqueue, reconcileNow, syncNow, writeSidecar]);

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
          let refusal: string | undefined;
          await enqueue(async () => {
            await reconcileNow();
            const file = selectedRef.current;
            const manifests = manifestsOf(buffersRef.current);
            const at = file ? nameAt(manifests, file, offset) : null;
            const to = newName.trim();
            if (!at) return void (refusal = t.renameGone);
            if (to === at.ref.name) return;
            const files = to ? renameElement(manifests, at.ref, to) : null;
            if (!files) return void (refusal = t.renameRefused(to));
            setTexts(files);
            const binding = bindingRef.current;
            if (binding) {
              const from = keyOf(at.ref);
              const id = binding.state.ids[from];
              const state = renameInBinding(binding.state, from, keyOf({ ...at.ref, name: to }));
              await persist({ ...binding, state });
              if (id) api.applyChanges({ update: [{ id, name: to }] });
            }
            await syncNow();
          });
          return refusal;
        },
      }),
      [enqueue, persist, reconcileNow, syncNow, t],
    );

    // While the folder is open, the chat context (API 1.6) reads and edits these buffers.
    useEffect(() => {
      if (!folder || !diagramId) return;
      return openSession({
        diagramId,
        manifests: () => manifestsOf(buffersRef.current),
        config: () => {
          const config = buffersRef.current.find((b) => b.name === CONFIG_FILE);
          return config && { name: config.name, text: config.text };
        },
        apply: (files) => {
          setTexts(files);
          void sync();
        },
      });
    }, [folder, diagramId, sync]);

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
        buffersRef.current = loaded;
        setFolder(opened);
        setBuffers(loaded);
        setSelected((previous) =>
          previous && names.includes(previous) ? previous : (names.find(isManifest) ?? null),
        );
        await sync();
      },
      [sync],
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
                {b.text !== b.disk ? " •" : ""}
              </button>
            ))}
        </div>
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
          {notInYaml > 0 ? ` · ${t.notInYaml(notInYaml)}` : ""}
          {problemsElsewhere > 0 ? ` · ${t.problemsElsewhere(problemsElsewhere)}` : ""}
        </div>
      </div>
    );
  };
}
