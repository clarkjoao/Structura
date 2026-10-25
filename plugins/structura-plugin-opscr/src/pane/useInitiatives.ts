import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { LOCK_FILE, planPromote, serializeLock, updateLock, type Diagnostic } from "opscr/core";
import { CONFIG_FILE, isManifest, projector } from "../project";
import type { SourceText } from "../engine/patches";
import { setSpecField } from "../engine/patches";
import {
  InitiativeVersions,
  initiativesDir,
  productOf,
  type BufferPort,
  type InitiativeBindings,
  type InitiativeInfo,
  type InitiativeTarget,
} from "../engine/initiatives";
import type { BindingState } from "../engine/sync";
import type { PluginVersionStatus, StructuraPluginApi } from "../types/plugin.types";

/** Lock rules that block promote until the architect settles them. */
const LOCK_RULES = new Set(["workspace/unlocked", "workspace/base-changed", "workspace/base-gone"]);

/** An initiative as the pane lists it. */
interface InitiativeRow extends InitiativeInfo {
  /** Root elements the initiative copied that changed since (or were never locked). */
  lockIssues: Diagnostic[];
}

const storageKey = (diagramId: string) => `initiatives:${diagramId}`;

/**
 * opscr initiatives as Versions for the folder bound to `diagramId` (plugin API 1.14): one
 * Version per `initiatives/<name>/` in the bound diagram and in each View diagram, canvas edits in
 * a Version written to that initiative, and the Version panel's actions (new, rename, delete,
 * merge) carried out on the buffers — unsaved until Save, like every other change of the pane.
 */
export function useInitiatives(options: {
  api: StructuraPluginApi;
  diagramId: string | null;
  /** The folder is open and the diagram's binding is read. */
  ready: boolean;
  buffersRef: MutableRefObject<Array<{ name: string; text: string }>>;
  buffers: BufferPort;
  /** The bound diagram's root binding. */
  baseBinding: () => BindingState | undefined;
  /** The View diagrams and their root bindings, when they are on. */
  viewTargets: () => InitiativeTarget[];
  /** Says what happened (a promote refused, an edit that could not be written). */
  report: (message: string) => void;
  newTitle: string;
}) {
  const { api, diagramId, ready, buffersRef, buffers, baseBinding, viewTargets, report, newTitle } =
    options;
  const [rows, setRows] = useState<InitiativeRow[]>([]);
  const bindingsRef = useRef<InitiativeBindings>({});
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const live = useRef({ baseBinding, viewTargets, report, buffers });
  live.current = { baseBinding, viewTargets, report, buffers };

  /** The buffers as stable arrays, so the product parsed from them is cached per change. */
  const textsCache = useRef<{ from: unknown; texts: SourceText[] }>({ from: null, texts: [] });
  const texts = useCallback((): SourceText[] => {
    const now = buffersRef.current;
    if (textsCache.current.from !== now) {
      textsCache.current = { from: now, texts: now.map((b) => ({ name: b.name, text: b.text })) };
    }
    return textsCache.current.texts;
  }, [buffersRef]);
  const product = useCallback(() => productOf(texts(), isManifest, CONFIG_FILE), [texts]);

  useEffect(() => {
    setLoadedFor(null);
    bindingsRef.current = {};
    if (!diagramId) return;
    let current = true;
    void api.storage.get<InitiativeBindings>(storageKey(diagramId)).then((stored) => {
      if (!current) return;
      bindingsRef.current = stored ?? {};
      setLoadedFor(diagramId);
    });
    return () => {
      current = false;
    };
  }, [api, diagramId]);

  const targets = useCallback((): InitiativeTarget[] => {
    if (!diagramId) return [];
    const main: InitiativeTarget = {
      diagramId,
      baseBinding: () => live.current.baseBinding() ?? { ids: {}, connections: {}, signatures: {} },
    };
    return [main, ...live.current.viewTargets()];
  }, [diagramId]);

  const manager = useMemo(() => {
    if (!ready || !diagramId || loadedFor !== diagramId) return null;
    return new InitiativeVersions({
      host: {
        getDiagram: (id, key) => api.getDiagram(id, { version: key }),
        applyChanges: (changes, id, version) =>
          api.applyChanges(changes, { diagramId: id, version }),
        versions: (id) =>
          api.versions
            .list(id)
            .filter((v) => v.ownerPluginId === "structura-plugin-opscr")
            .map((v) => ({ key: v.key, name: v.name, status: v.status })),
        removeVersion: (id, key) => api.versions.remove(key, { diagramId: id }),
        activeVersion: (id) => api.getDiagram(id)?.activeVersion?.key ?? null,
        setActiveVersion: (id, key) => api.versions.setActive(key, { diagramId: id }),
      },
      buffers: {
        get: texts,
        set: (files) => live.current.buffers.set(files),
        remove: (names) => live.current.buffers.remove(names),
      },
      targets,
      bindings: {
        get: () => bindingsRef.current,
        set: (next) => {
          bindingsRef.current = next;
          return api.storage.set(storageKey(diagramId), next);
        },
      },
      project: projector,
      isManifest,
      configFile: CONFIG_FILE,
      onEvent: (event) => {
        if ("problem" in event) live.current.report(event.problem.join(" "));
      },
    });
  }, [api, ready, diagramId, loadedFor, texts, targets]);

  /** The rows the pane lists, from the buffers as they are now. */
  const refreshRows = useCallback(() => {
    const p = product();
    setRows(
      (p?.initiatives ?? []).map((i) => {
        const info = manager?.initiatives().find((x) => x.name === i.name);
        return {
          name: i.name,
          title: info?.title ?? i.name,
          status: info?.status ?? null,
          lockIssues: i.diagnostics.filter(
            (d) => d.ruleId !== undefined && LOCK_RULES.has(d.ruleId),
          ),
        };
      }),
    );
  }, [product, manager]);

  /** After the folder changed: every Version follows its initiative. */
  const sync = useCallback(async () => {
    refreshRows();
    const rootDrawn = Object.keys(live.current.baseBinding()?.ids ?? {}).length > 0;
    if (!manager || !product() || !rootDrawn) return;
    await manager.sync();
  }, [manager, product, refreshRows]);

  // Once the root is drawn (its binding says where each root element is), the Versions follow;
  // before that they would draw the root again beside it. Later syncs come after each root sync.
  useEffect(() => {
    void sync();
  }, [sync]);

  /** The initiative whose Version a diagram shows, if it is one of this folder's. */
  const shownOn = useCallback(
    (id: string): string | undefined => {
      const key = api.getDiagram(id)?.activeVersion?.key ?? null;
      return key !== null && product()?.initiatives.some((i) => i.name === key) ? key : undefined;
    },
    [api, product],
  );

  /** A canvas change on a diagram showing an initiative: written to that initiative. */
  const canvasChanged = useCallback(
    (id: string, key: string) => manager?.canvasChanged(id, key),
    [manager],
  );

  /** Sets a field of an initiative's `Initiative` manifest. */
  const setField = useCallback(
    async (name: string, field: string, value: string) => {
      const initiative = product()?.initiatives.find((i) => i.name === name);
      const file = initiative?.manifest?.sourceFile;
      const current = texts().find((t) => t.name === file);
      if (!current) return;
      const next = setSpecField([current], { kind: "Initiative", name }, field, value);
      if (next) await live.current.buffers.set(next);
      await sync();
    },
    [product, texts, sync],
  );

  const setStatus = (name: string, status: PluginVersionStatus) => setField(name, "status", status);

  /** Records the current root version of what the initiative copied: its lock conflicts settle. */
  const accept = useCallback(
    async (name: string) => {
      const initiative = product()?.initiatives.find((i) => i.name === name);
      if (!initiative) return;
      const keys = initiative.composed.entries.filter((e) => e.base).map((e) => e.key);
      const text = serializeLock(updateLock(initiative, keys).lock);
      await live.current.buffers.set([{ name: `${initiative.sources.dir}/${LOCK_FILE}`, text }]);
      await sync();
    },
    [product, sync],
  );

  /** The initiative goes onto the root (opscr promote), in the buffers; or why it cannot. */
  const promote = useCallback(
    async (name: string): Promise<boolean> => {
      const p = product();
      if (!p) return false;
      const plan = await planPromote(p, name);
      if (!plan.ok) {
        live.current.report(plan.diagnostics.map((d) => `[${d.ruleId}] ${d.message}`).join(" · "));
        return false;
      }
      const writes: SourceText[] = [];
      const removed: string[] = [];
      for (const op of plan.operations) {
        if (op.op === "write") writes.push({ name: op.path, text: op.content });
        else if (op.op === "delete") removed.push(op.path);
        else
          removed.push(
            ...texts()
              .filter((t) => t.name.startsWith(`${op.path}/`))
              .map((t) => t.name),
          );
      }
      await live.current.buffers.set(writes);
      await live.current.buffers.remove(removed);
      await sync();
      return true;
    },
    [product, texts, sync],
  );

  /** A new initiative folder with its `Initiative`, unsaved; resolves to its name. */
  const create = useCallback(async (): Promise<string | undefined> => {
    const dir = initiativesDir(texts());
    if (dir === undefined) return undefined;
    const taken = new Set(product()?.initiatives.map((i) => i.name));
    let n = 1;
    while (taken.has(`initiative-${n}`)) n++;
    const name = `initiative-${n}`;
    await live.current.buffers.set([
      {
        name: `${dir}/${name}/initiative.opscr.yaml`,
        text: [
          "apiVersion: opscr.dev/v1",
          "kind: Initiative",
          "metadata:",
          `  name: ${name}`,
          "spec:",
          `  displayName: ${JSON.stringify(newTitle)}`,
          "  status: proposed",
          "",
        ].join("\n"),
      },
    ]);
    await sync();
    return name;
  }, [texts, product, newTitle, sync]);

  /** Drops an initiative's files (deleted from the folder on Save). */
  const remove = useCallback(
    async (name: string) => {
      const dir = initiativesDir(texts());
      if (dir === undefined) return;
      await live.current.buffers.remove(
        texts()
          .filter((t) => t.name.startsWith(`${dir}/${name}/`))
          .map((t) => t.name),
      );
      await sync();
    },
    [texts, sync],
  );

  // The Version panel's actions on this folder's Versions, in any diagram bound to it.
  useEffect(() => {
    if (!manager || !diagramId) return;
    return api.versions.onAction((action) => {
      if (!targets().some((t) => t.diagramId === action.diagramId)) return;
      void (async () => {
        if (action.type === "create") {
          const name = await create();
          if (name) api.versions.setActive(name, { diagramId: action.diagramId });
        } else if (action.type === "rename") {
          await setField(action.key, "displayName", action.name);
        } else if (action.type === "delete") {
          await remove(action.key);
        } else if (await promote(action.key)) {
          api.versions.setActive(null, { diagramId: action.diagramId });
        }
      })();
    });
  }, [api, manager, diagramId, targets, create, setField, remove, promote]);

  return {
    /** The folder is a product workspace. */
    active: product() !== null,
    rows,
    sync,
    shownOn,
    canvasChanged,
    sidecarChanged: () => manager?.sidecarChanged(),
    setStatus,
    accept,
    promote,
    create,
    show: (name: string | null) => diagramId && api.versions.setActive(name, { diagramId }),
    reset: () => manager?.reset(),
  };
}
