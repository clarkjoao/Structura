import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { CONFIG_FILE, isManifest, projector } from "../project";
import type { SourceText } from "../engine/patches";
import { ViewDiagrams, emptyViewDiagrams, type ViewDiagramsState } from "../engine/view-diagrams";
import { isRootFile, type InitiativeTarget } from "../engine/initiatives";
import { emptyBinding } from "../engine/sync";
import type { StructuraPluginApi } from "../types/plugin.types";

/**
 * The bound folder is the AS-IS: the pane reads and writes the diagram's base, never the Version
 * the canvas may be showing (initiative editing comes with the Versions-as-initiatives work).
 */
const BASE = { base: true } as const;

/** The diagrams made for Views, as the pane lists them. */
export interface ViewDiagramsReport {
  diagrams: Array<{ view: string; diagramId: string; name: string }>;
  orphans: Array<{ view: string; diagramId: string }>;
}

export interface StoredViewDiagrams {
  enabled: boolean;
  state: ViewDiagramsState;
}

/** Where the switch is kept per bound diagram (a workspace import writes it too). */
export const viewDiagramsStorageKey = (diagramId: string) => `view-diagrams:${diagramId}`;
const EMPTY: ViewDiagramsReport = { diagrams: [], orphans: [] };

/**
 * One diagram per opscr View for the folder bound to `diagramId` (plugin API 1.13): switched on by
 * the user, remembered per bound diagram, kept in sync by `ViewDiagrams` while the folder is open.
 * Turning it off stops the syncing and keeps the diagrams: they are the user's now.
 */
export function useViewDiagrams(options: {
  api: StructuraPluginApi;
  diagramId: string | null;
  /** The folder is open and the diagram's binding is read. */
  ready: boolean;
  buffersRef: MutableRefObject<Array<{ name: string; text: string }>>;
  setTexts: (files: readonly SourceText[]) => void;
  /** The initiative whose Version a diagram shows: its canvas edits are that initiative's. */
  initiativeShownOn?: (diagramId: string) => string | undefined;
  onInitiativeCanvas?: (diagramId: string, initiative: string) => void;
  /** After the diagrams were made or followed the YAML on their own (switched on, reopened). */
  onSynced?: () => void;
}) {
  const { api, diagramId, ready, buffersRef, setTexts } = options;
  const routes = useRef(options);
  routes.current = options;
  const [enabled, setEnabled] = useState(false);
  const [loadedFor, setLoadedFor] = useState<string | null>(null);
  const [report, setReport] = useState<ViewDiagramsReport>(EMPTY);
  const stateRef = useRef<ViewDiagramsState>(emptyViewDiagrams());
  const setTextsRef = useRef(setTexts);
  setTextsRef.current = setTexts;

  // What was remembered for this diagram.
  useEffect(() => {
    setLoadedFor(null);
    setEnabled(false);
    setReport(EMPTY);
    stateRef.current = emptyViewDiagrams();
    if (!diagramId) return;
    let current = true;
    void api.storage.get<StoredViewDiagrams>(viewDiagramsStorageKey(diagramId)).then((stored) => {
      if (!current) return;
      stateRef.current = stored?.state ?? emptyViewDiagrams();
      setEnabled(stored?.enabled === true);
      setLoadedFor(diagramId);
    });
    return () => {
      current = false;
    };
  }, [api, diagramId]);

  const manager = useMemo(() => {
    if (!enabled || !ready || !diagramId || loadedFor !== diagramId) return null;
    return new ViewDiagrams({
      host: {
        // Beside the bound diagram, in its workspace folder.
        createDiagram: (input) =>
          api.createDiagram({ ...input, folderId: api.getDiagram(diagramId)?.folderId ?? null }),
        getDiagram: (id) => api.getDiagram(id, BASE),
        applyChanges: (changes, id) => api.applyChanges(changes, { diagramId: id, base: true }),
      },
      texts: {
        // The root only: initiatives are drawn as Versions of these diagrams (`useInitiatives`).
        get: () =>
          buffersRef.current
            .filter((b) => isRootFile(b.name))
            .map((b) => ({ name: b.name, text: b.text })),
        set: (files) => setTextsRef.current(files),
      },
      state: {
        get: () => stateRef.current,
        set: (state) => {
          stateRef.current = state;
          return api.storage.set(viewDiagramsStorageKey(diagramId), { enabled: true, state });
        },
      },
      project: projector,
      isManifest,
      configFile: CONFIG_FILE,
      onEvent: (event) => {
        if (event.type === "view-diagrams") {
          setReport({ diagrams: event.diagrams, orphans: event.orphans });
        }
      },
    });
  }, [api, enabled, ready, diagramId, loadedFor, buffersRef]);

  // The diagrams follow the folder from the moment they are switched on; the initiatives' Versions
  // then follow them.
  useEffect(() => {
    if (manager) void manager.sync().then(() => routes.current.onSynced?.());
  }, [manager]);

  // A box moved on one of them (or an undo) reaches the layout sidecar.
  useEffect(() => {
    if (!manager) return;
    return api.onDiagramChange((changed) => {
      if (manager.viewOf(changed) === undefined) return;
      const initiative = routes.current.initiativeShownOn?.(changed);
      if (initiative !== undefined) routes.current.onInitiativeCanvas?.(changed, initiative);
      else void manager.canvasChanged(changed);
    });
  }, [api, manager]);

  return {
    enabled,
    report,
    /** Switches the diagrams on or off; remembered for this bound diagram. */
    setEnabled(next: boolean) {
      if (!diagramId) return;
      setEnabled(next);
      void api.storage.set(viewDiagramsStorageKey(diagramId), {
        enabled: next,
        state: stateRef.current,
      });
    },
    /** After the YAML changed. */
    sync: () => manager?.sync(),
    /** The layout sidecar changed outside. */
    sidecarChanged: (text: string) => manager?.sidecarChanged(text),
    /** The View diagrams, for the initiatives to draw their Versions on. */
    targets: (): InitiativeTarget[] =>
      manager
        ? Object.entries(stateRef.current.diagrams).map(([view, id]) => ({
            diagramId: id,
            view,
            baseBinding: () => stateRef.current.bindings[id] ?? { ...emptyBinding(), view },
            resolveLink: (target: string) => manager.diagramFor(target),
          }))
        : [],
  };
}
