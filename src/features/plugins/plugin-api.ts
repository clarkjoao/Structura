import React from "react";
import type { IStoragePort } from "@/infrastructure/persistence";
import type { NodeTypeDescriptor } from "@/features/canvas/nodes/node-types/types";
import { SPREAD_HANDLES } from "@/features/canvas/nodes/node-types/handle-spec";
import {
  registerDescriptor,
  unregisterDescriptor,
} from "@/features/canvas/nodes/node-types/registry";
// Leaf import (not the @/features/diagram barrel): this module loads at app boot.
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import {
  STRUCTURA_PLUGIN_API_VERSION,
  type DiagramSnapshot,
  type ExporterContribution,
  type ImporterContribution,
  type ModalOptions,
  type PanelContribution,
  type PluginCapability,
  type PluginComponentPatch,
  type PluginDiagramChanges,
  type PluginDiagramChangesResult,
  type PluginFiles,
  type PluginManifest,
  type PluginNodeTypeDescriptor,
  type StructuraPluginApi,
  type ToastOptions,
} from "./plugin.types";
import {
  registerExporterContribution,
  registerImporterContribution,
  unregisterExporterContribution,
  unregisterImporterContribution,
} from "./io-registry";
import { registerPanelContribution, unregisterPanelContribution } from "./panel-registry";
import { createPluginStorage } from "./plugin-storage";
import { subscribeDiagramChange } from "./diagram-change-notifier";
import { sanitizeComponentPatch, toComponentSnapshot, toDiagramSnapshot } from "./snapshots";
import { overlayRegistry } from "./overlay-registry";
import { toGeneratedGraph } from "./import-graph";
import { PluginCodeEditor } from "./components/PluginCodeEditor";
import { createPluginFolders } from "@/infrastructure/persistence/pluginFolders";

/**
 * Everything a plugin registered, tracked by the host so deactivation can bulk-unregister
 * without the plugin handing back tokens (scoped-facade model, RFC D1/D3).
 */
export interface PluginContributionTracker {
  rfTypes: string[];
  importerIds: string[];
  exporterIds: string[];
  panelIds: string[];
  unsubscribers: Array<() => void>;
}

export function createContributionTracker(): PluginContributionTracker {
  return { rfTypes: [], importerIds: [], exporterIds: [], panelIds: [], unsubscribers: [] };
}

/** Roll back every tracked contribution; registries end as if the plugin never registered. */
export function rollbackContributions(tracker: PluginContributionTracker): void {
  for (const rfType of tracker.rfTypes) unregisterDescriptor(rfType);
  for (const id of tracker.importerIds) unregisterImporterContribution(id);
  for (const id of tracker.exporterIds) unregisterExporterContribution(id);
  for (const id of tracker.panelIds) unregisterPanelContribution(id);
  for (const unsubscribe of tracker.unsubscribers) {
    try {
      unsubscribe();
    } catch (error) {
      console.error("[plugins] unsubscribe threw during rollback:", error);
    }
  }
  tracker.rfTypes = [];
  tracker.importerIds = [];
  tracker.exporterIds = [];
  tracker.panelIds = [];
  tracker.unsubscribers = [];
}

function warnUndeclaredCapability(manifest: PluginManifest, capability: PluginCapability): void {
  // Observability now, enforcement later (RFC D2): undeclared use is logged, not blocked.
  if (!manifest.capabilities.includes(capability)) {
    console.warn(
      `[plugins] Plugin "${manifest.id}" uses API requiring undeclared capability "${capability}".`,
    );
  }
}

function assertNamespaced(pluginId: string, field: string, value: string): void {
  if (!value.startsWith(`${pluginId}/`)) {
    throw new Error(
      `[plugins] ${field} "${value}" must be namespaced "${pluginId}/<name>" so it cannot collide with built-ins or other plugins.`,
    );
  }
}

function toInternalDescriptor(descriptor: PluginNodeTypeDescriptor): NodeTypeDescriptor {
  return {
    rfType: descriptor.rfType,
    component: descriptor.component,
    matches: (type) => type === descriptor.componentType,
    zIndex: descriptor.zIndex ?? 1,
    connectable: descriptor.connectable ?? true,
    // A plugin does not declare its handle set: the API hands it `NodeProps`
    // and nothing else, so a plugin node renders whatever its own component
    // renders. The general spec is the only safe assumption.
    handles: SPREAD_HANDLES,
    canHaveParent: descriptor.canHaveParent ?? true,
    canBeParent: descriptor.canBeParent ?? false,
    // Plugins get the stable read-only snapshot, never the internal NodeBuildContext.
    buildData: (comp, ctx) =>
      descriptor.buildData(toComponentSnapshot(comp, ctx.resolvedNodeLayouts[comp.id])),
    defaultSize: descriptor.defaultSize,
    defaultData: descriptor.defaultData,
    draggable: descriptor.draggable,
    selectable: descriptor.selectable,
  };
}

/** Folder access for one plugin; the capability is checked on use, like the others. */
function scopedFiles(manifest: PluginManifest): PluginFiles {
  const folders = createPluginFolders(manifest.id);
  const check = () => warnUndeclaredCapability(manifest, "files:folder");
  return {
    isSupported: () => folders.isSupported(),
    pick: (bindingId) => (check(), folders.pick(String(bindingId))),
    open: (bindingId) => (check(), folders.open(String(bindingId))),
    forget: (bindingId) => (check(), folders.forget(String(bindingId))),
  };
}

/** The per-plugin StructuraPluginApi facade handed to activate() (RFC D4). */
export function createScopedPluginApi(
  manifest: PluginManifest,
  tracker: PluginContributionTracker,
  storagePort?: IStoragePort,
): StructuraPluginApi {
  return {
    apiVersion: STRUCTURA_PLUGIN_API_VERSION,

    registerNodeType(descriptor: PluginNodeTypeDescriptor): void {
      warnUndeclaredCapability(manifest, "canvas:node-types");
      assertNamespaced(manifest.id, "rfType", descriptor.rfType);
      assertNamespaced(manifest.id, "componentType", descriptor.componentType);
      registerDescriptor(toInternalDescriptor(descriptor));
      tracker.rfTypes.push(descriptor.rfType);
    },

    registerImporter(handler: ImporterContribution): void {
      warnUndeclaredCapability(manifest, "io:importers");
      registerImporterContribution(handler);
      tracker.importerIds.push(handler.id);
    },

    registerExporter(handler: ExporterContribution): void {
      warnUndeclaredCapability(manifest, "io:exporters");
      registerExporterContribution(handler);
      tracker.exporterIds.push(handler.id);
    },

    registerPanel(section: PanelContribution): void {
      warnUndeclaredCapability(manifest, "ui:panels");
      registerPanelContribution(section);
      tracker.panelIds.push(section.id);
    },

    onDiagramChange(callback: (diagramId: string) => void): () => void {
      warnUndeclaredCapability(manifest, "events:diagram");
      const unsubscribe = subscribeDiagramChange(callback);
      tracker.unsubscribers.push(unsubscribe);
      return unsubscribe;
    },

    getActiveDiagramId(): string | null {
      warnUndeclaredCapability(manifest, "diagram:read");
      return useDiagramStore.getState().activeDiagramId ?? null;
    },

    getDiagram(diagramId?: string): DiagramSnapshot | null {
      warnUndeclaredCapability(manifest, "diagram:read");
      const state = useDiagramStore.getState();
      const id = diagramId ?? state.activeDiagramId;
      const diagram = id ? state.diagrams[id] : undefined;
      // Fresh projection per call: plugins can never reach store objects through it.
      return diagram ? toDiagramSnapshot(diagram) : null;
    },

    updateComponent(componentId: string, patch: PluginComponentPatch): void {
      warnUndeclaredCapability(manifest, "diagram:write");
      // Same sanctioned path as PluginPanelContext: whitelisted fields, history pushed
      // by the store action, active diagram only.
      useDiagramStore.getState().updateComponent(componentId, sanitizeComponentPatch(patch));
    },

    moveComponents(moves: Array<{ id: string; x: number; y: number }>): void {
      warnUndeclaredCapability(manifest, "diagram:write");
      const layouts = moves
        .filter(
          (move) =>
            typeof move?.id === "string" && Number.isFinite(move.x) && Number.isFinite(move.y),
        )
        .map((move) => ({ elementId: move.id, x: move.x, y: move.y }));
      if (layouts.length === 0) return;
      // applyAutoLayout pushes ONE history step for the batch — a single undo reverts
      // the whole rearrangement — and skips unknown element ids itself.
      useDiagramStore.getState().applyAutoLayout(layouts);
    },

    applyChanges(changes: PluginDiagramChanges): PluginDiagramChangesResult {
      warnUndeclaredCapability(manifest, "diagram:write");
      const strings = (value: unknown): string[] =>
        Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
      const optionalString = (value: unknown) => (typeof value === "string" ? value : undefined);
      // Plugin data is untrusted: adds go through the importer normalization (type policy,
      // parent cycles), updates keep to their whitelist.
      const graph = toGeneratedGraph({
        components: Array.isArray(changes.add) ? changes.add : [],
        connections: Array.isArray(changes.connect) ? changes.connect : [],
      });
      const result = useDiagramStore.getState().applyGraphChanges({
        remove: strings(changes.remove),
        disconnect: strings(changes.disconnect),
        update: (Array.isArray(changes.update) ? changes.update : [])
          .filter((u) => typeof u?.id === "string")
          .map((u) => {
            // Request data: the store writes the field through `cloudServiceIdClearingPatch`.
            const cloudServiceId = optionalString(u.cloudServiceId);
            return {
              id: u.id,
              name: optionalString(u.name),
              description: optionalString(u.description),
              technology: optionalString(u.technology),
              cloudServiceId,
            };
          }),
        move: (Array.isArray(changes.move) ? changes.move : []).filter(
          (m) => typeof m?.id === "string" && Number.isFinite(m.x) && Number.isFinite(m.y),
        ),
        add: graph.nodes,
        connect: graph.edges,
      });
      return { idsByKey: result.componentIdByExternalId, connectionIds: result.connectionIds };
    },

    files: scopedFiles(manifest),

    ui: { CodeEditor: PluginCodeEditor },

    storage: createPluginStorage(manifest.id, storagePort),

    // Deprecated since API 1.2.0: React is now shared as a host global that plugin bundles
    // bind to as a build-time external (installPluginRuntimeGlobals). Kept for pre-1.2
    // plugins that still read api.dependencies.react.
    dependencies: {
      get react(): typeof React | undefined {
        if (manifest.uses?.includes("react")) {
          return React;
        }
        return undefined;
      },
    },

    overlay: {
      showToast(options: ToastOptions): void {
        warnUndeclaredCapability(manifest, "ui:overlays");
        overlayRegistry.showToast(options);
      },

      openModal(options: ModalOptions): void {
        warnUndeclaredCapability(manifest, "ui:overlays");
        overlayRegistry.openModal(options);
      },
    },
  };
}
