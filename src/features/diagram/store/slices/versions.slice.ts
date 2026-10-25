import { current } from "immer";
import type {
  Component,
  Connection,
  Diagram,
  NodeLayout,
  VersionDiff,
  VersionStatus,
} from "../../model/diagram.types";
import { generateId } from "../../utils/generate-id";
import type { AppState } from "../store.types";
import {
  computeMergePreview,
  isModifiedInVersion,
  nextVersionColor,
} from "../../utils/version.utils";
import { hashElement } from "../../utils/element-hash";
import {
  mutateRemoveComponentInVersion,
  mutateRemoveConnectionInVersion,
} from "../../utils/version-mutations";
import { STRUCTURAL_MUTATION_MARKER } from "../store.constants";
import { pushHistory } from "./history.slice";
import { getActiveDiagram, touchDiagram } from "../helpers/get-active-diagram";
import { publishSewNotices } from "../helpers/publish-sew-notices";
import { resolveActiveVersion } from "../helpers/version-helpers";
import i18n from "@/infrastructure/i18n";
import { canBeConnectionSource, canBeConnectionTarget } from "../../model/connection-rules";

function ensureVersions(d: Diagram): Record<string, VersionDiff> {
  if (!d.versions) d.versions = {};
  return d.versions;
}

export const versionsSlice = (
  set: (fn: (state: AppState) => void) => void,
  _get: () => AppState,
) => ({
  duplicateVersion: (versionId: string, name?: string): VersionDiff | null => {
    let created: VersionDiff | null = null;
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const src = d?.versions?.[versionId];
      if (!src) return;
      const versions = ensureVersions(d);
      const index = Object.keys(versions).length;
      const id = generateId("version");
      // `src` is an immer draft here, and a draft is a Proxy: structuredClone throws on it.
      const copy = structuredClone(current(src)) as VersionDiff;
      copy.id = id;
      const baseName = name?.trim() || i18n.t("versions.duplicatedVersionName", { name: src.name });
      copy.name = baseName;
      copy.createdAt = Date.now();
      copy.color = nextVersionColor(index);
      // A duplicate is the user's own: not tied to the original's outside key or owning plugin.
      delete copy.key;
      delete copy.ownerPluginId;
      versions[id] = copy;
      created = copy;
      touchDiagram(d);
    });
    return created;
  },

  addVersion: (name: string): VersionDiff => {
    let created!: VersionDiff;
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      const versions = ensureVersions(d);
      const index = Object.keys(versions).length;
      const id = generateId("version");
      created = {
        id,
        name: name.trim() || i18n.t("versions.numberedDefaultName", { number: index + 1 }),
        color: nextVersionColor(index),
        createdAt: Date.now(),
        addedComponents: {},
        addedConnections: {},
        removedComponentIds: [],
        removedConnectionIds: [],
        nodeLayouts: {},
      };
      versions[id] = created;
      touchDiagram(d);
    });
    return created;
  },

  removeVersion: (versionId: string) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d?.versions?.[versionId]) return;
      pushHistory(state, STRUCTURAL_MUTATION_MARKER);
      delete d.versions[versionId];
      if (Object.keys(d.versions).length === 0) {
        d.versions = undefined;
      }
      if (d.activeVersionId === versionId) {
        d.activeVersionId = null;
      }
      if (d.compareVersionId === versionId) {
        d.compareVersionId = null;
      }
      touchDiagram(d);
    });
  },

  setActiveVersion: (versionId: string | null) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      if (versionId !== null && !d.versions?.[versionId]) return;

      d.compareVersionId = null;

      const prev = d.activeVersionId ?? null;
      const vp = { ...d.viewport };
      if (prev && d.versions?.[prev]) {
        d.versions[prev].viewport = vp;
      }

      d.activeVersionId = versionId;

      if (versionId && d.versions?.[versionId]?.viewport) {
        const next = d.versions[versionId].viewport!;
        d.viewport = { x: next.x, y: next.y, zoom: next.zoom };
      }
      touchDiagram(d);
    });
  },

  setCompareVersion: (versionId: string | null) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d) return;
      if (versionId === null) {
        d.compareVersionId = null;
        touchDiagram(d);
        return;
      }
      const activeVersion = resolveActiveVersion(d);
      if (!activeVersion) return;
      if (versionId === activeVersion.id) return;
      if (!d.versions?.[versionId]) return;
      d.compareVersionId = versionId;
      touchDiagram(d);
    });
  },

  renameVersion: (versionId: string, name: string) => {
    set((state) => {
      const d = getActiveDiagram(state);
      const sc = d?.versions?.[versionId];
      if (!sc) return;
      const t = name.trim();
      if (t) sc.name = t;
      touchDiagram(d);
    });
  },

  /**
   * Writes the Version into the base and deletes it. Refused (`false`) while the Version has
   * conflicts: a copy whose base changed since would overwrite that change silently.
   */
  mergeVersionIntoBase: (versionId: string): boolean => {
    let merged = false;
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d?.versions?.[versionId]) return;
      let preview: ReturnType<typeof computeMergePreview>;
      try {
        preview = computeMergePreview(d, versionId);
      } catch {
        return;
      }
      if (preview.blocking.length > 0) return;

      pushHistory(state, STRUCTURAL_MUTATION_MARKER);

      for (const comp of [...preview.componentsToAdd, ...preview.componentsToReplace]) {
        d.snapshot.components[comp.id] = comp;
      }
      for (const conn of [...preview.connectionsToAdd, ...preview.connectionsToReplace]) {
        d.snapshot.connections[conn.id] = conn;
      }
      Object.assign(d.nodeLayouts, preview.layoutsToAdd);

      for (const id of preview.componentIdsToRemove) {
        delete d.snapshot.components[id];
        delete d.nodeLayouts[id];
      }
      for (const id of preview.connectionIdsToRemove) {
        delete d.snapshot.connections[id];
      }

      const removeCompSet = new Set(preview.componentIdsToRemove);
      const removeConnSet = new Set(preview.connectionIdsToRemove);
      const scenesMap = d.versions!;

      for (const other of Object.values(scenesMap)) {
        if (other.id === versionId) continue;
        other.removedComponentIds = other.removedComponentIds.filter(
          (id) => !removeCompSet.has(id),
        );
        other.removedConnectionIds = other.removedConnectionIds.filter(
          (id) => !removeConnSet.has(id),
        );
        for (const comp of preview.componentsToAdd) {
          if (other.addedComponents[comp.id]) {
            delete other.addedComponents[comp.id];
            delete other.nodeLayouts[comp.id];
          }
        }
        for (const conn of preview.connectionsToAdd) {
          if (other.addedConnections[conn.id]) {
            delete other.addedConnections[conn.id];
          }
        }
        // Copies of what the merge removed have no base left; the ones of what it replaced keep
        // their old base hash and so report a conflict — the base moved on under them.
        for (const id of preview.componentIdsToRemove) {
          if (other.modifiedComponents) delete other.modifiedComponents[id];
          if (other.baseHashes) delete other.baseHashes[id];
        }
        for (const id of preview.connectionIdsToRemove) {
          if (other.modifiedConnections) delete other.modifiedConnections[id];
          if (other.baseHashes) delete other.baseHashes[id];
        }
      }

      delete scenesMap[versionId];
      if (Object.keys(scenesMap).length === 0) {
        d.versions = undefined;
      }
      if (d.activeVersionId === versionId) {
        d.activeVersionId = null;
      }
      if (d.compareVersionId === versionId) {
        d.compareVersionId = null;
      }
      merged = true;
      touchDiagram(d);
    });
    return merged;
  },

  /** Deletes the Version with `key` in that diagram (a plugin's own source dropped it). */
  removeVersionByKey: (diagramId: string, key: string) => {
    set((state) => {
      const d = state.diagrams[diagramId];
      const version = Object.values(d?.versions ?? {}).find((v) => v.key === key);
      if (!d?.versions || !version) return;
      pushHistory(state, STRUCTURAL_MUTATION_MARKER, d);
      delete d.versions[version.id];
      if (Object.keys(d.versions).length === 0) d.versions = undefined;
      if (d.activeVersionId === version.id) d.activeVersionId = null;
      if (d.compareVersionId === version.id) d.compareVersionId = null;
      touchDiagram(d);
    });
  },

  /** Shows the Version with `key` in that diagram, or its base for null / an unknown key. */
  setActiveVersionByKey: (diagramId: string, key: string | null) => {
    set((state) => {
      const d = state.diagrams[diagramId];
      if (!d) return;
      const version =
        key === null ? undefined : Object.values(d.versions ?? {}).find((v) => v.key === key);
      d.activeVersionId = version?.id ?? null;
      d.compareVersionId = null;
      touchDiagram(d);
    });
  },

  /**
   * Keeps one initiative selected across linked diagrams: when `fromDiagramId` shows a Version
   * with a `key`, `toDiagramId` shows its Version with the same key, or its base when it has
   * none. A source on its base or on a Version without a key changes nothing.
   */
  carryActiveVersionKey: (fromDiagramId: string, toDiagramId: string) => {
    set((state) => {
      const from = state.diagrams[fromDiagramId];
      const to = state.diagrams[toDiagramId];
      if (!from || !to || from === to) return;
      const key = from.activeVersionId ? from.versions?.[from.activeVersionId]?.key : undefined;
      if (key === undefined) return;
      const match = Object.values(to.versions ?? {}).find((v) => v.key === key);
      to.activeVersionId = match?.id ?? null;
      to.compareVersionId = null;
    });
  },

  setVersionStatus: (versionId: string, status: VersionStatus | null) => {
    set((state) => {
      const d = getActiveDiagram(state);
      const version = d?.versions?.[versionId];
      if (!version) return;
      if (status === null) delete version.status;
      else version.status = status;
      touchDiagram(d);
    });
  },

  /** Resolves a conflict for the Version's copy: it stays, rebased on the base as it is now. */
  keepVersionCopy: (versionId: string, elementId: string) => {
    set((state) => {
      const d = getActiveDiagram(state);
      const version = d?.versions?.[versionId];
      if (!version) return;
      const base = d.snapshot.components[elementId] ?? d.snapshot.connections[elementId];
      if (!base || !isModifiedInVersion(version, elementId)) return;
      pushHistory(state, STRUCTURAL_MUTATION_MARKER);
      version.baseHashes ??= {};
      version.baseHashes[elementId] = hashElement(current(base));
      touchDiagram(d);
    });
  },

  /** Resolves a conflict by dropping the Version's copy: the element shows the base again. */
  takeBaseVersion: (versionId: string, elementId: string) => {
    set((state) => {
      const d = getActiveDiagram(state);
      const version = d?.versions?.[versionId];
      if (!version || !isModifiedInVersion(version, elementId)) return;
      pushHistory(state, STRUCTURAL_MUTATION_MARKER);
      if (version.modifiedComponents) delete version.modifiedComponents[elementId];
      if (version.modifiedConnections) delete version.modifiedConnections[elementId];
      if (version.baseHashes) delete version.baseHashes[elementId];
      touchDiagram(d);
    });
  },

  addComponentToVersion: (versionId: string, component: Component, layout: NodeLayout) => {
    set((state) => {
      const d = getActiveDiagram(state);
      const sc = d?.versions?.[versionId];
      if (!sc) return;
      pushHistory(state, STRUCTURAL_MUTATION_MARKER);
      sc.addedComponents[component.id] = component;
      sc.nodeLayouts[component.id] = { ...layout, elementId: component.id };
      touchDiagram(d);
    });
  },

  removeComponentFromVersion: (versionId: string, componentId: string) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d?.versions?.[versionId]) return;
      pushHistory(state, STRUCTURAL_MUTATION_MARKER);
      publishSewNotices(state, mutateRemoveComponentInVersion(d, versionId, componentId));
      touchDiagram(d);
    });
  },

  addConnectionToVersion: (versionId: string, connection: Connection) => {
    set((state) => {
      const d = getActiveDiagram(state);
      const sc = d?.versions?.[versionId];
      if (!sc) return;
      // Same rule as `addConnection`: nothing leaves a note, a JSON viewer or
      // a db-table, and a scene is not an exception to it.
      const sourceType =
        sc.addedComponents?.[connection.sourceId]?.type ??
        d!.snapshot.components[connection.sourceId]?.type;
      if (sourceType !== undefined && !canBeConnectionSource(sourceType)) return;
      const targetType =
        sc.addedComponents?.[connection.targetId]?.type ??
        d!.snapshot.components[connection.targetId]?.type;
      if (targetType !== undefined && !canBeConnectionTarget(targetType)) return;
      pushHistory(state, STRUCTURAL_MUTATION_MARKER);
      sc.addedConnections[connection.id] = connection;
      touchDiagram(d);
    });
  },

  removeConnectionFromVersion: (versionId: string, connectionId: string) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d?.versions?.[versionId]) return;
      pushHistory(state, STRUCTURAL_MUTATION_MARKER);
      publishSewNotices(state, mutateRemoveConnectionInVersion(d, versionId, connectionId));
      touchDiagram(d);
    });
  },

  updateVersionNodeLayout: (
    versionId: string,
    elementId: string,
    position: { x: number; y: number },
    dimensions?: { width: number; height: number },
  ) => {
    set((state) => {
      const d = getActiveDiagram(state);
      const sc = d?.versions?.[versionId];
      if (!sc) return;
      const layout = sc.nodeLayouts[elementId];
      if (!layout) return;
      layout.x = position.x;
      layout.y = position.y;
      if (dimensions) {
        layout.width = dimensions.width;
        layout.height = dimensions.height;
      }
      touchDiagram(d);
    });
  },
});
