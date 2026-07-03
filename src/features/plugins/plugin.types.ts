import type { ComponentType as ReactComponentType } from "react";
import type { NodeTypes } from "@xyflow/react";

/**
 * Public surface of the Structura plugin system (RFC:
 * openspec/changes/archive/2026-07-03-add-plugin-system-foundation/design.md).
 * Everything in this file is an API contract versioned by STRUCTURA_PLUGIN_API_VERSION —
 * breaking changes here require a major version bump.
 */

export const STRUCTURA_PLUGIN_API_VERSION = "1.0.0";

export const KNOWN_PLUGIN_CAPABILITIES = [
  "canvas:node-types",
  "io:importers",
  "io:exporters",
  "ui:panels",
  "events:diagram",
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

export type PluginPanelSlot = "element-inspector" | "service-registry-import";

export interface PluginPanelContext {
  /** Read-only snapshot of the current selection (element-inspector slot). */
  selection: readonly PluginComponentSnapshot[];
  /** Read-only snapshot of the service being viewed (service-registry slot). */
  service: PluginServiceSnapshot | null;
  /** Sanctioned mutations — routed through store actions, pushHistory included. */
  updateComponent(id: string, patch: PluginComponentPatch): void;
  updateService(id: string, patch: PluginServicePatch): void;
  /** Current locale ("en" | "pt-BR"), so plugins can localize their own text. */
  locale: string;
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

  /** Plugin-scoped persistent key-value storage. */
  readonly storage: PluginStorage;
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
