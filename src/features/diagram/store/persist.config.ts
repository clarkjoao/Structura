import { createJSONStorage } from "zustand/middleware";
import type { IStoragePort } from "@/infrastructure/persistence";
import { LocalStorageAdapter } from "@/infrastructure/persistence/LocalStorageAdapter";
import {
  clearLocalStorageDiagramSyncTimestamp,
  recordLocalStorageDiagramSyncSuccess,
} from "@/infrastructure/persistence/localStorageSyncTimestamp";
import { useIconStore } from "@/features/icons";
import type {
  Diagram,
  Component,
  Connection,
  IconDefinition,
  NodeLayout,
} from "../model/diagram.types";
import type { Point, EdgeControlPoint } from "../model/layout.types";
import type { DiagramStore } from "./store.types";
import type { ServiceDefinition } from "../model/service.types";
import { ServiceSource } from "../enums";
import { generateId } from "../utils/generate-id";
import { migrateFlow } from "../utils/flow-migration";
import { useSaveStatusStore } from "./saveStatus.store";
import { isQuotaExceededError } from "@/infrastructure/persistence/storageQuota";

export const PERSIST_KEY = "diagram-store";

/** localStorage persist debounce; folder sync uses VIEWPORT_DEBOUNCE_MS — they are independent by design. */
const PERSIST_DEBOUNCE_MS = 1000;

export const PERSIST_SCHEMA_VERSION = 11;

export const CURRENT_SCHEMA_VERSION = PERSIST_SCHEMA_VERSION;

export type PersistedDiagramStoreSlice = ReturnType<typeof partializeState>;

export function partializeState(state: DiagramStore) {
  return {
    diagrams: state.diagrams,
    folders: state.folders,
    userTemplates: state.userTemplates,
    serviceCatalog: state.serviceCatalog,
    activeDiagramId: state.activeDiagramId,
  };
}

export function buildPersistStoragePayload(state: DiagramStore): {
  state: PersistedDiagramStoreSlice;
  version: number;
} {
  return {
    state: partializeState(state),
    version: PERSIST_SCHEMA_VERSION,
  };
}

function migrateServiceSources(state: DiagramStore): DiagramStore {
  Object.values(state.serviceCatalog).forEach((service) => {
    const svc = service as ServiceDefinition;
    if (svc.sources && svc.sources.length > 0) return;
    if (svc.source) {
      svc.sources = [{ type: svc.source, sourceId: svc.sourceId }];
      return;
    }
    svc.sources = [{ type: ServiceSource.Manual }];
  });
  return state;
}

function migrateDiagramCreatedAt(state: DiagramStore): DiagramStore {
  Object.values(state.diagrams ?? {}).forEach((d) => {
    const diagram = d as Diagram & { createdAt?: number };
    if (!diagram.createdAt) diagram.createdAt = diagram.updatedAt;
  });
  return state;
}

function migrateNodeLayoutsFromArray(state: DiagramStore): DiagramStore {
  Object.values(state.diagrams ?? {}).forEach((d) => {
    const diagram = d as Diagram & { nodeLayouts: unknown };
    if (Array.isArray(diagram.nodeLayouts)) {
      const arr = diagram.nodeLayouts as NodeLayout[];
      (diagram as Diagram).nodeLayouts = Object.fromEntries(arr.map((nl) => [nl.elementId, nl]));
    }
  });
  return state;
}

function migrateConnectionStyles(state: DiagramStore): DiagramStore {
  Object.values(state.diagrams ?? {}).forEach((d) => {
    const diagram = d as Diagram;
    Object.values(diagram.snapshot.connections ?? {}).forEach((conn) => {
      type LegacyConn = Connection & {
        edgeStyle?: string;
        strokeStyle?: string;
        strokeWidth?: number;
        markerEnd?: string;
        markerStart?: string;
        animated?: boolean;
      };
      const c = conn as LegacyConn;
      const hasLoose =
        c.edgeStyle !== undefined ||
        c.strokeStyle !== undefined ||
        c.strokeWidth !== undefined ||
        c.markerEnd !== undefined ||
        c.markerStart !== undefined ||
        c.animated !== undefined;
      if (hasLoose) {
        (c as { style?: object }).style = {
          edgeStyle: c.edgeStyle,
          strokeStyle: c.strokeStyle,
          strokeWidth: c.strokeWidth,
          markerEnd: c.markerEnd,
          markerStart: c.markerStart,
          animated: c.animated,
          ...c.style,
        };
        delete c.edgeStyle;
        delete c.strokeStyle;
        delete c.strokeWidth;
        delete c.markerEnd;
        delete c.markerStart;
        delete c.animated;
      }
    });
  });
  return state;
}

function migrateComponentDimensions(state: DiagramStore): DiagramStore {
  Object.values(state.diagrams ?? {}).forEach((d) => {
    const diagram = d as Diagram;
    Object.values(diagram.snapshot.components ?? {}).forEach((comp) => {
      type LegacyComp = Component & { width?: number; height?: number };
      const co = comp as LegacyComp;
      if (co.width !== undefined || co.height !== undefined) {
        const layout = diagram.nodeLayouts[co.id];
        if (layout) {
          if (co.width !== undefined && layout.width === undefined) layout.width = co.width;
          if (co.height !== undefined && layout.height === undefined) layout.height = co.height;
        }
        delete co.width;
        delete co.height;
      }
    });
  });
  return state;
}

function migrateFlowsToGraph(state: DiagramStore): DiagramStore {
  Object.values(state.diagrams ?? {}).forEach((d) => {
    const diagram = d as Diagram;
    if (diagram.snapshot?.flows) {
      for (const flowId of Object.keys(diagram.snapshot.flows)) {
        diagram.snapshot.flows[flowId] = migrateFlow(diagram.snapshot.flows[flowId]);
      }
    }
  });
  return state;
}

function migrateAddIconLibrary(state: Partial<DiagramStore>): void {
  const touchSnapshot = (snapshot: Diagram["snapshot"] | undefined): void => {
    if (!snapshot) return;
    if (!snapshot.iconLibrary) {
      snapshot.iconLibrary = {};
    }
    for (const component of Object.values(snapshot.components ?? {})) {
      if (!("customIconId" in component)) {
        (component as Component).customIconId = undefined;
      }
    }
  };

  for (const diagram of Object.values(state.diagrams ?? {})) {
    touchSnapshot((diagram as Diagram).snapshot);
  }
}

function migrateAddEdgeLayouts(state: Partial<DiagramStore>): void {
  for (const diagram of Object.values(state.diagrams ?? {})) {
    const diagramRecord = diagram as Diagram;
    diagramRecord.edgeLayouts ??= {};
  }
}

function migrateEdgeLayoutsFromArray(state: Partial<DiagramStore>): void {
  for (const diagram of Object.values(state.diagrams ?? {})) {
    const d = diagram as Diagram & { edgeLayouts: unknown };
    if (Array.isArray(d.edgeLayouts)) {
      const arr = d.edgeLayouts as Array<{
        connectionId: string;
        waypoints: Point[];
        labelOffset?: number;
      }>;
      (d as Diagram).edgeLayouts = Object.fromEntries(
        arr.map(({ connectionId, waypoints, labelOffset }) => [
          connectionId,
          { waypoints, ...(labelOffset !== undefined ? { labelOffset } : {}) },
        ]),
      );
    } else if (!d.edgeLayouts || typeof d.edgeLayouts !== "object") {
      (d as Diagram).edgeLayouts = {};
    }
  }
}

/**
 * Convert the legacy `edgeLayouts[*].waypoints: Point[]` shape into the
 * control-point model `points: EdgeControlPoint[]` (stable ids). Idempotent:
 * entries already using `points`, or with no waypoints, are left untouched.
 */
export function migrateEdgeWaypointsToPoints(state: Partial<DiagramStore>): void {
  for (const diagram of Object.values(state.diagrams ?? {})) {
    const edgeLayouts = (diagram as Diagram).edgeLayouts;
    if (!edgeLayouts || typeof edgeLayouts !== "object") continue;
    for (const layout of Object.values(edgeLayouts)) {
      const legacy = layout as { waypoints?: Point[]; points?: EdgeControlPoint[] };
      if (legacy.points) {
        delete legacy.waypoints;
        continue;
      }
      if (Array.isArray(legacy.waypoints)) {
        legacy.points = legacy.waypoints.map((wp) => ({
          id: generateId("cp"),
          x: wp.x,
          y: wp.y,
        }));
        delete legacy.waypoints;
      }
    }
  }
}

function migrateFlowNodeTypeToProcessos(state: Partial<DiagramStore>): void {
  const migrateComponents = (components: Record<string, Component> | undefined): void => {
    if (!components) return;
    for (const comp of Object.values(components)) {
      const record = comp as { type: string };
      if (record.type === "flow-node") {
        record.type = "processos";
      }
    }
  };

  for (const diagram of Object.values(state.diagrams ?? {})) {
    const d = diagram as Diagram;
    migrateComponents(d.snapshot?.components);
    for (const scene of Object.values(d.scenes ?? {})) {
      migrateComponents(scene.addedComponents);
    }
  }
}

/** Schema v7: rename the component type `"processos"` → `"process-node"`.
 * The legacy `"flow-node"` was already migrated to `"processos"` in v6; this
 * migration supersedes that name with the canonical English one and also
 * catches any workspace that still has `"flow-node"` directly. */
function migrateProcessNodeTypeToProcessNode(state: Partial<DiagramStore>): void {
  const migrateComponents = (components: Record<string, Component> | undefined): void => {
    if (!components) return;
    for (const comp of Object.values(components)) {
      const record = comp as { type: string };
      if (record.type === "processos" || record.type === "flow-node") {
        record.type = "process-node";
      }
    }
  };

  for (const diagram of Object.values(state.diagrams ?? {})) {
    const d = diagram as Diagram;
    migrateComponents(d.snapshot?.components);
    for (const scene of Object.values(d.scenes ?? {})) {
      migrateComponents(scene.addedComponents);
    }
  }
}

/** Schema v8: rename the persisted state field `serviceRegistry` →
 * `serviceCatalog`. The values inside are unchanged. The migration is
 * idempotent: if `serviceCatalog` already exists with content (e.g. a
 * workspace saved at v8 is re-read at v8), the right-hand side is
 * short-circuited. Note: the currentState spread always sets
 * `serviceCatalog = {}` (the in-memory default), so the "not present"
 * check must look at whether the dictionary is empty, not at
 * `undefined`. The legacy key is always dropped. */
function migrateServiceRegistryToServiceCatalog(state: Record<string, unknown>): void {
  const legacy = state.serviceRegistry;
  if (legacy && typeof legacy === "object" && !Array.isArray(legacy)) {
    const existing = state.serviceCatalog as Record<string, unknown> | undefined;
    const existingIsEmpty = !existing || Object.keys(existing).length === 0;
    if (existingIsEmpty) {
      state.serviceCatalog = legacy as Record<string, unknown>;
    }
  }
  delete state.serviceRegistry;
}

/** Schema v10: rename `ExternalElementComponent.linkedDiagramId` to
 * `referenceDiagramId`. The two fields had the same name but different
 * semantics: drill-down (BaseComponent.linkedDiagramId, the C4 contract)
 * and cross-diagram reference (ExternalElementComponent). Only the
 * second is renamed. The migration is idempotent. */
function migrateExternalElementLinkedDiagramId(state: Partial<DiagramStore>): void {
  const migrate = (components: Record<string, Component> | undefined): void => {
    if (!components) return;
    for (const comp of Object.values(components)) {
      if (comp.type !== "external-element") continue;
      const ext = comp as unknown as Record<string, unknown>;
      if (typeof ext.linkedDiagramId === "string" && ext.referenceDiagramId === undefined) {
        ext.referenceDiagramId = ext.linkedDiagramId;
      }
      delete ext.linkedDiagramId;
    }
  };
  for (const diagram of Object.values(state.diagrams ?? {})) {
    const d = diagram as Diagram;
    migrate(d.snapshot?.components);
    for (const scene of Object.values(d.scenes ?? {})) {
      migrate(scene.addedComponents);
    }
  }
}

/** Schema v11: unify `Component.registryServiceId` into `serviceId`.
 * The two fields carried the same intent; the legacy field was used
 * by the custom-component template instancing path and by plugin
 * snapshots, but it caused `linkComponentToService` to silently miss
 * the link. The migration copies any `registryServiceId` value to
 * `serviceId` (if `serviceId` is empty) and deletes the old field.
 * Idempotent: an already-v11 state has no `registryServiceId`. */
function migrateUnifyRegistryServiceId(state: Partial<DiagramStore>): void {
  const migrate = (components: Record<string, Component> | undefined): void => {
    if (!components) return;
    for (const comp of Object.values(components)) {
      const ext = comp as unknown as Record<string, unknown>;
      const legacy = ext.registryServiceId;
      if (typeof legacy === "string" && legacy.length > 0) {
        if (ext.serviceId === undefined || ext.serviceId === "") {
          ext.serviceId = legacy;
        }
      }
      delete ext.registryServiceId;
    }
  };
  for (const diagram of Object.values(state.diagrams ?? {})) {
    const d = diagram as Diagram;
    migrate(d.snapshot?.components);
    for (const scene of Object.values(d.scenes ?? {})) {
      migrate(scene.addedComponents);
    }
  }
}

function migrateAddDiagramDescription(state: Partial<DiagramStore>): void {
  for (const diagram of Object.values(state.diagrams ?? {})) {
    const diagramRecord = diagram as Diagram;
    diagramRecord.description ??= undefined;
  }
}

function migrateAddUserTemplates(state: Partial<DiagramStore>): void {
  state.userTemplates ??= {};
}

function migrateIconDefinitionToSource(state: Partial<DiagramStore>): void {
  const migrateLibrary = (library: Record<string, IconDefinition> | undefined): void => {
    if (!library) return;
    for (const [id, icon] of Object.entries(library)) {
      const entry = icon as unknown as Record<string, unknown>;
      if (
        typeof entry.svgContent === "string" &&
        entry.svgContent.length > 0 &&
        !("source" in entry)
      ) {
        const svgContent = entry.svgContent as string;
        library[id] = {
          id: typeof entry.id === "string" && entry.id.length > 0 ? entry.id : id,
          name: typeof entry.name === "string" ? entry.name : id,
          createdAt:
            typeof entry.createdAt === "number" && Number.isFinite(entry.createdAt)
              ? entry.createdAt
              : Date.now(),
          usageCount:
            typeof entry.usageCount === "number" &&
            entry.usageCount >= 0 &&
            Number.isFinite(entry.usageCount)
              ? entry.usageCount
              : 0,
          source: { kind: "svg", svgContent },
        };
      }
    }
  };

  for (const diagram of Object.values(state.diagrams ?? {})) {
    migrateLibrary((diagram as Diagram)?.snapshot?.iconLibrary);
  }
}

function hasEmbeddedIconLibraryInDiagrams(state: DiagramStore): boolean {
  for (const diagram of Object.values(state.diagrams ?? {})) {
    const library = (diagram as Diagram).snapshot?.iconLibrary;
    if (library && Object.keys(library).length > 0) return true;
  }
  return false;
}

function migrateIconLibraryToGlobalStore(state: DiagramStore): void {
  try {
    const migrateSnapshot = (snapshot: Diagram["snapshot"] | undefined): void => {
      if (!snapshot) {
        return;
      }
      const library = snapshot.iconLibrary;
      if (!library || Object.keys(library).length === 0) {
        return;
      }
      const globalIcons = useIconStore.getState().icons;
      for (const [iconId, icon] of Object.entries(library)) {
        if (!globalIcons[iconId]) {
          useIconStore.getState().addIcon(icon);
        }
      }
      snapshot.iconLibrary = {};
    };

    for (const diagram of Object.values(state.diagrams ?? {})) {
      migrateSnapshot((diagram as Diagram).snapshot);
    }
  } catch (err) {
    console.warn("[persist.config] Failed to migrate snapshot:", err);
  }
}

export function mergePersistedState(
  persistedState: unknown,
  currentState: DiagramStore,
): DiagramStore {
  const state = {
    ...currentState,
    ...(persistedState ? (persistedState as Partial<DiagramStore>) : {}),
  } as DiagramStore;

  state.clipboard = currentState.clipboard ?? null;
  state.past = [];
  state.future = [];
  state._lastUndoRedoAt = 0;

  if (!state.serviceCatalog) state.serviceCatalog = {};
  if (!state.folders) state.folders = {};
  migrateAddUserTemplates(state);

  let next = state;
  next = migrateServiceSources(next);
  next = migrateDiagramCreatedAt(next);
  next = migrateNodeLayoutsFromArray(next);
  next = migrateConnectionStyles(next);
  next = migrateComponentDimensions(next);
  next = migrateFlowsToGraph(next);
  migrateEdgeLayoutsFromArray(next);
  migrateAddIconLibrary(next);
  migrateIconDefinitionToSource(next);
  migrateAddEdgeLayouts(next);
  migrateEdgeWaypointsToPoints(next);
  migrateAddDiagramDescription(next);
  migrateFlowNodeTypeToProcessos(next);
  migrateProcessNodeTypeToProcessNode(next);
  migrateServiceRegistryToServiceCatalog(next as unknown as Record<string, unknown>);
  migrateExternalElementLinkedDiagramId(next);
  migrateUnifyRegistryServiceId(next);
  if (hasEmbeddedIconLibraryInDiagrams(next)) {
    migrateIconLibraryToGlobalStore(next);
  }

  return next;
}

export function wrapIStoragePortWithDiagramPersistTracking(storage: IStoragePort): IStoragePort {
  let persistDebounceTimer: ReturnType<typeof setTimeout> | null = null;
  let pendingPersist: { name: string; value: string } | null = null;

  const flushPersist = async (): Promise<void> => {
    persistDebounceTimer = null;
    if (!pendingPersist) return;
    const { name, value } = pendingPersist;
    pendingPersist = null;
    try {
      await storage.setItem(name, value);
      if (name !== PERSIST_KEY) return;
      useSaveStatusStore.getState()._setSaved();
      if (storage instanceof LocalStorageAdapter && storage.paused) return;
      recordLocalStorageDiagramSyncSuccess();
    } catch (err: unknown) {
      if (name !== PERSIST_KEY) return;
      if (isQuotaExceededError(err)) {
        useSaveStatusStore.getState()._setStorageCritical();
      }
      useSaveStatusStore.getState()._setError();
    }
  };

  const schedulePersist = (name: string, value: string): void => {
    if (name === PERSIST_KEY) {
      useSaveStatusStore.getState()._setSaving();
    }
    pendingPersist = { name, value };
    if (persistDebounceTimer !== null) {
      clearTimeout(persistDebounceTimer);
    }
    persistDebounceTimer = setTimeout(() => {
      void flushPersist();
    }, PERSIST_DEBOUNCE_MS);
  };

  if (typeof window !== "undefined") {
    window.addEventListener("beforeunload", () => {
      if (persistDebounceTimer !== null) {
        clearTimeout(persistDebounceTimer);
        persistDebounceTimer = null;
      }
      if (!pendingPersist || pendingPersist.name !== PERSIST_KEY) return;
      const { name, value } = pendingPersist;
      pendingPersist = null;
      try {
        if (storage instanceof LocalStorageAdapter) {
          storage.setItemSync(name, value);
          if (storage.paused) return;
          recordLocalStorageDiagramSyncSuccess();
          useSaveStatusStore.getState()._setSaved();
        } else {
          void storage
            .setItem(name, value)
            .then(() => {
              recordLocalStorageDiagramSyncSuccess();
              useSaveStatusStore.getState()._setSaved();
            })
            .catch((err: unknown) => {
              if (isQuotaExceededError(err)) {
                useSaveStatusStore.getState()._setStorageCritical();
              }
              useSaveStatusStore.getState()._setError();
            });
        }
      } catch (err: unknown) {
        if (isQuotaExceededError(err)) {
          useSaveStatusStore.getState()._setStorageCritical();
        }
        useSaveStatusStore.getState()._setError();
      }
    });
  }

  return {
    getItem: (key) => storage.getItem(key),
    setItem: async (name, value) => {
      if (name !== PERSIST_KEY) {
        await storage.setItem(name, value);
        return;
      }
      schedulePersist(name, value);
    },
    removeItem: async (key) => {
      if (key === PERSIST_KEY) {
        if (persistDebounceTimer !== null) {
          clearTimeout(persistDebounceTimer);
          persistDebounceTimer = null;
        }
        pendingPersist = null;
      }
      await storage.removeItem(key);
      if (key === PERSIST_KEY) {
        clearLocalStorageDiagramSyncTimestamp();
      }
    },
    save: (key, data) => storage.save(key, data),
    load: (key) => storage.load(key),
    delete: async (key) => {
      if (key === PERSIST_KEY) {
        if (persistDebounceTimer !== null) {
          clearTimeout(persistDebounceTimer);
          persistDebounceTimer = null;
        }
        pendingPersist = null;
      }
      await storage.delete(key);
      if (key === PERSIST_KEY) {
        clearLocalStorageDiagramSyncTimestamp();
      }
    },
    keys: () => storage.keys(),
    length: () => storage.length(),
  };
}

export function createPersistConfig(storage: IStoragePort) {
  const trackedStorage = wrapIStoragePortWithDiagramPersistTracking(storage);
  const SCHEMA_VERSION_EDGE_LAYOUTS_RECORD = 5;
  const SCHEMA_VERSION_EDGE_CONTROL_POINTS = 6;
  return {
    name: PERSIST_KEY,
    storage: createJSONStorage(() => trackedStorage),
    partialize: partializeState,
    merge: mergePersistedState,
    version: PERSIST_SCHEMA_VERSION,
    migrate: (persistedState: unknown, fromVersion: number) => {
      if (typeof fromVersion !== "number") {
        return persistedState as PersistedDiagramStoreSlice;
      }
      const partial = persistedState as Partial<DiagramStore>;
      if (fromVersion < SCHEMA_VERSION_EDGE_LAYOUTS_RECORD) {
        migrateEdgeLayoutsFromArray(partial);
      }
      if (fromVersion < SCHEMA_VERSION_EDGE_CONTROL_POINTS) {
        migrateEdgeWaypointsToPoints(partial);
      }
      return persistedState as PersistedDiagramStoreSlice;
    },
  };
}
