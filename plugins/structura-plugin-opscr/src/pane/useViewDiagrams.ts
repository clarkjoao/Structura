import { useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { CONFIG_FILE, isManifest, projector } from "../project";
import type { SourceText } from "../engine/patches";
import { ViewDiagrams, emptyViewDiagrams, type ViewDiagramsState } from "../engine/view-diagrams";
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

interface Stored {
  enabled: boolean;
  state: ViewDiagramsState;
}

const storageKey = (diagramId: string) => `view-diagrams:${diagramId}`;
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
}) {
  const { api, diagramId, ready, buffersRef, setTexts } = options;
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
    void api.storage.get<Stored>(storageKey(diagramId)).then((stored) => {
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
        createDiagram: (input) => api.createDiagram(input),
        getDiagram: (id) => api.getDiagram(id, BASE),
        applyChanges: (changes, id) => api.applyChanges(changes, { diagramId: id }),
      },
      texts: {
        get: () => buffersRef.current.map((b) => ({ name: b.name, text: b.text })),
        set: (files) => setTextsRef.current(files),
      },
      state: {
        get: () => stateRef.current,
        set: (state) => {
          stateRef.current = state;
          return api.storage.set(storageKey(diagramId), { enabled: true, state });
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

  // The diagrams follow the folder from the moment they are switched on.
  useEffect(() => {
    if (manager) void manager.sync();
  }, [manager]);

  // A box moved on one of them (or an undo) reaches the layout sidecar.
  useEffect(() => {
    if (!manager) return;
    return api.onDiagramChange((changed) => {
      if (manager.viewOf(changed) !== undefined) void manager.canvasChanged(changed);
    });
  }, [api, manager]);

  return {
    enabled,
    report,
    /** Switches the diagrams on or off; remembered for this bound diagram. */
    setEnabled(next: boolean) {
      if (!diagramId) return;
      setEnabled(next);
      void api.storage.set(storageKey(diagramId), { enabled: next, state: stateRef.current });
    },
    /** After the YAML changed. */
    sync: () => manager?.sync(),
    /** The layout sidecar changed outside. */
    sidecarChanged: (text: string) => manager?.sidecarChanged(text),
  };
}
