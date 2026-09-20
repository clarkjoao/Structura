import type {
  Component,
  Connection,
  Diagram,
  NodeLayout,
  VersionDiff,
} from "../../model/diagram.types";
import { generateId } from "../../utils/generate-id";
import type { AppState } from "../store.types";
import { computeMergePreview, nextVersionColor } from "../../utils/version.utils";
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
import { canBeConnectionSource } from "../../model/connection-rules";

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
      const copy = structuredClone(src) as VersionDiff;
      copy.id = id;
      const baseName = name?.trim() || i18n.t("versions.duplicatedVersionName", { name: src.name });
      copy.name = baseName;
      copy.createdAt = Date.now();
      copy.color = nextVersionColor(index);
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

  mergeVersionIntoBase: (versionId: string) => {
    set((state) => {
      const d = getActiveDiagram(state);
      if (!d?.versions?.[versionId]) return;
      let preview: ReturnType<typeof computeMergePreview>;
      try {
        preview = computeMergePreview(d, versionId);
      } catch {
        return;
      }

      pushHistory(state, STRUCTURAL_MUTATION_MARKER);

      for (const comp of preview.componentsToAdd) {
        d.snapshot.components[comp.id] = comp;
      }
      for (const conn of preview.connectionsToAdd) {
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
