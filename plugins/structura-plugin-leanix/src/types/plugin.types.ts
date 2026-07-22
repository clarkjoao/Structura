/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of the host plugin API contract
 * (src/features/plugins/plugin.types.ts), synced via `npm run sync-types`.
 * It is the single source of truth for plugin/host type compatibility; edit the host
 * file and re-run the sync instead of changing this file.
 */

import type { ComponentType as ReactComponentType } from "react";
import type { NodeTypes } from "@xyflow/react";

/**
 * Public surface of the Structura plugin system (RFC:
 * openspec/changes/archive/2026-07-03-add-plugin-system-foundation/design.md).
 * Everything in this file is an API contract versioned by STRUCTURA_PLUGIN_API_VERSION —
 * breaking changes here require a major version bump.
 */

export const STRUCTURA_PLUGIN_API_VERSION = "1.2.0";

export const KNOWN_PLUGIN_CAPABILITIES = [
  "canvas:node-types",
  "io:importers",
  "io:exporters",
  "ui:panels",
  "ui:overlays",
  "events:diagram",
  "diagram:read",
  "diagram:write",
  "storage",
  "network",
] as const;

export type PluginCapability = (typeof KNOWN_PLUGIN_CAPABILITIES)[number];

export interface PluginManifest {
  /** Unique id, npm-style or reverse-DNS (e.g. "structura-plugin-defectdojo"). */
  id: string;
  /** Display name (shown in the plugin manager UI). */
  name: string;
  /** Plugin's own version. MUST be valid semver. */
  version: string;
  author: string;
  description: string;
  /**
   * Semver range of the StructuraPlugin API the plugin supports (e.g. "^1.0").
   * Checked at registration; incompatible → not activated.
   */
  apiVersion: string;
  /**
   * Declared capabilities. Not enforced in the MVP (no sandbox) — declared anyway so the
   * plugin manager can display them and a future sandbox can enforce them without a
   * manifest format break.
   */
  capabilities: PluginCapability[];
  /** Entry point for future npm distribution; ignored for single-file MVP plugins. */
  entry?: string;
  /**
   * @deprecated since API 1.2.0. React is now shared as a host global that plugin bundles
   * bind to as a build-time external (see runtime-globals.ts), so plugins write ordinary
   * `import ... from "react"` and no longer need to request it here. Retained so existing
   * `uses: ["react"]` manifests keep validating.
   */
  uses?: string[];
}

/** Plain string, or per-locale map resolved against the active locale. */
export type LocalizedText = string | Partial<Record<"en" | "pt-BR", string>>;

/** Read-only projection of a diagram component handed to plugin code. */
export interface PluginComponentSnapshot {
  id: string;
  /** Domain component type (built-in or "<pluginId>/<name>"). */
  type: string;
  label: string;
  description: string;
  /** Containing panel/group id, or null at the diagram root (v1.1). */
  parentId: string | null;
  position: { x: number; y: number } | null;
  size: { width: number; height: number } | null;
  tags: readonly string[];
  serviceId: string | null;
}

export interface PluginConnectionSnapshot {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  description: string | null;
  technology: string | null;
}

export interface PluginServiceSnapshot {
  id: string;
  name: string;
  description: string;
  repositoryUrl: string;
  technology: readonly string[];
  owner: string | null;
  tags: readonly string[];
}

/** Read-only diagram projection handed to exporters. */
export interface DiagramSnapshot {
  id: string;
  name: string;
  description: string | null;
  components: readonly PluginComponentSnapshot[];
  connections: readonly PluginConnectionSnapshot[];
}

/** Whitelisted component fields a plugin may patch (applied via store actions, undoable). */
export interface PluginComponentPatch {
  name?: string;
  description?: string;
  tags?: string[];
}

/** Whitelisted service fields a plugin may patch (applied via store actions, undoable). */
export interface PluginServicePatch {
  name?: string;
  description?: string;
  repositoryUrl?: string;
  technology?: string[];
  owner?: string;
  tags?: string[];
}

/**
 * New component returned by an importer. `key` is plugin-local: the host assigns real ids
 * and resolves connection endpoints against keys (new components) or existing component ids.
 */
export interface PluginComponentInput {
  key: string;
  name: string;
  /** Defaults to "unknown" when omitted; plugin node types must be "<pluginId>/<name>". */
  type?: string;
  description?: string;
  x: number;
  y: number;
  width?: number;
  height?: number;
}

export interface PluginConnectionInput {
  /** A PluginComponentInput.key or an existing component id from ImportContext. */
  source: string;
  /** A PluginComponentInput.key or an existing component id from ImportContext. */
  target: string;
  label?: string;
}

export interface ImportContext {
  /** Read-only snapshots of the target diagram, for merge/dedupe decisions. */
  existingComponents: Readonly<Record<string, PluginComponentSnapshot>>;
  existingConnections: Readonly<Record<string, PluginConnectionSnapshot>>;
  /** Canvas position where imported content should be anchored. */
  anchor: { x: number; y: number };
}

export interface ImportResult {
  components: PluginComponentInput[];
  connections: PluginConnectionInput[];
  warnings: string[];
}

export interface ImporterContribution {
  id: string;
  label: LocalizedText;
  /** Extensions without dot, e.g. ["mmd", "mermaid"]. */
  extensions: string[];
  /** Optional content sniffing when the extension is ambiguous. */
  canImport?(fileName: string, contents: string): boolean;
  import(contents: string, ctx: ImportContext): ImportResult | Promise<ImportResult>;
}

export interface ExporterContribution {
  id: string;
  label: LocalizedText;
  /** File extension without dot, e.g. "puml". */
  extension: string;
  mime: string;
  /** Pure: receives a read-only diagram snapshot, returns file content. */
  export(diagram: DiagramSnapshot): string | Promise<string>;
}

export type PluginPanelSlot = "element-inspector" | "service-registry-import" | "canvas-toolbar";

/**
 * Context handed to every plugin panel, whatever slot it fills. v1.2 unified the former
 * split between inspector and toolbar contexts into this single shape so a `PanelContribution`
 * component is typed the same regardless of slot. Fields that don't apply to a slot are
 * still present with safe values (empty selection / null service on the canvas-toolbar slot).
 */
export interface PluginPanelContext {
  /** Read-only snapshot of the current selection (element-inspector slot; [] elsewhere). */
  selection: readonly PluginComponentSnapshot[];
  /** Read-only snapshot of the service being viewed (service-registry slot; null elsewhere). */
  service: PluginServiceSnapshot | null;
  /** Sanctioned mutations — routed through store actions, pushHistory included. */
  updateComponent(id: string, patch: PluginComponentPatch): void;
  updateService(id: string, patch: PluginServicePatch): void;
  /** Current locale ("en" | "pt-BR"), so plugins can localize their own text. */
  locale: string;
  /** Whether the host canvas is in edit mode (canvas-toolbar slot); other slots pass true. */
  isEditMode: boolean;
}

export interface PluginPanelProps {
  context: PluginPanelContext;
}

export interface PanelContribution {
  id: string;
  slot: PluginPanelSlot;
  title: LocalizedText;
  /** React component; rendered inside the host slot, error-boundaried. */
  component: ReactComponentType<PluginPanelProps>;
}

// =============================================================================
// Overlay Types (Toast & Modal)
// =============================================================================

/** Options for displaying a toast notification. */
export interface ToastOptions {
  /** Toast type determines color/icon: "success" | "error" | "info" | "warning" */
  type: "success" | "error" | "info" | "warning";
  /** Required title text */
  title: string;
  /** Optional description/body text */
  description?: string;
  /** Optional action button */
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Duration in ms before auto-dismiss (default: 5000, 0 = persistent) */
  duration?: number;
}

/** Internal toast entry with generated ID */
export interface ToastEntry extends ToastOptions {
  id: string;
  createdAt: number;
}

/** Options for opening a modal dialog. */
export interface ModalOptions {
  /** Modal title displayed in header */
  title: string;
  /** React component for modal content */
  content: React.ComponentType<{ onClose: () => void }>;
  /** Optional callback when modal is closed */
  onClose?: () => void;
  /** Modal size: "sm" (400px) | "md" (500px, default) | "lg" (700px) */
  size?: "sm" | "md" | "lg";
}

/**
 * @deprecated since API 1.2.0 — merged into {@link PluginPanelContext}. Kept as an alias so
 * pre-1.2 toolbar panels keep compiling; new code should use PluginPanelContext.
 */
export type PluginToolbarContext = PluginPanelContext;

export interface PluginNodeTypeDescriptor {
  /**
   * React Flow type id. MUST be namespaced "<pluginId>/<name>" (host validates the prefix)
   * so plugin types can never collide with built-ins or other plugins.
   */
  rfType: string;
  /** React component rendered for the node (same contract as NodeTypes[string]). */
  component: NodeTypes[string];
  /** Domain component type this descriptor matches, namespaced the same way. */
  componentType: string;
  zIndex?: number;
  connectable?: boolean;
  canHaveParent?: boolean;
  canBeParent?: boolean;
  buildData: (comp: PluginComponentSnapshot) => Record<string, unknown>;
  defaultSize?: { width: number; height: number };
  defaultData?: Record<string, unknown>;
  draggable?: boolean;
  selectable?: boolean;
}

/** Plugin-scoped persistent key-value storage, namespaced per plugin id. */
export interface PluginStorage {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T): Promise<void>;
  remove(key: string): Promise<void>;
}

export interface StructuraPluginApi {
  /** Semver of this API surface, e.g. "1.0.0". */
  readonly apiVersion: string;

  registerNodeType(descriptor: PluginNodeTypeDescriptor): void;
  registerExporter(handler: ExporterContribution): void;
  registerImporter(handler: ImporterContribution): void;
  registerPanel(section: PanelContribution): void;

  /** Fires after any committed change to a diagram. Returns unsubscribe. */
  onDiagramChange(callback: (diagramId: string) => void): () => void;

  /** v1.1 — capability "diagram:read". Id of the active diagram, or null. */
  getActiveDiagramId(): string | null;

  /**
   * v1.1 — capability "diagram:read". Read-only snapshot of the requested diagram
   * (defaults to the active one); null when it does not exist.
   */
  getDiagram(diagramId?: string): DiagramSnapshot | null;

  /**
   * v1.1 — capability "diagram:write". Patch whitelisted fields of a component on the
   * ACTIVE diagram through the sanctioned store action; a single undo reverts it.
   */
  updateComponent(componentId: string, patch: PluginComponentPatch): void;

  /**
   * v1.1 — capability "diagram:write". Batch position changes on the ACTIVE diagram,
   * applied as one history step (a single undo reverts the whole batch). Unknown ids
   * are ignored.
   */
  moveComponents(moves: Array<{ id: string; x: number; y: number }>): void;

  /** Plugin-scoped persistent key-value storage. */
  readonly storage: PluginStorage;

  /**
   * @deprecated since API 1.2.0. React is shared as a host global that plugin bundles bind
   * to as a build-time external (see runtime-globals.ts). Prefer a plain
   * `import ... from "react"`; this handle is kept only for pre-1.2 plugins.
   */
  readonly dependencies: {
    /** @deprecated Use a normal `import ... from "react"` instead. */
    react?: unknown;
  };

  /** Overlay capabilities: toast notifications and modal dialogs (requires ui:overlays capability). */
  readonly overlay: {
    showToast(options: ToastOptions): void;
    openModal(options: ModalOptions): void;
  };
}

export interface PluginDefinition {
  manifest: PluginManifest;
  activate: (api: StructuraPluginApi) => void | Promise<void>;
  deactivate?: () => void | Promise<void>;
}

/** Shape of the global definition hook installed at window.StructuraPlugin. */
export interface StructuraPluginGlobal {
  define(definition: PluginDefinition): void;
}

/** Persisted install record (file snapshot model, RFC D3). */
export interface PluginInstallRecord {
  manifest: PluginManifest;
  /** Snapshot of the plugin file contents at install time. */
  code: string;
  enabled: boolean;
  errored: boolean;
  installedAt: number;
}
