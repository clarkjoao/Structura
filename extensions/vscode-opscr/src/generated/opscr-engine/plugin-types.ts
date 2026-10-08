/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Copy of the opscr plugin's src/engine (+ project.ts, plugin types), synced via `npm run sync-shared`.
 * Edit the source files and re-sync instead of changing this file.
 */

/**
 * AUTO-GENERATED — DO NOT EDIT BY HAND.
 * Verbatim copy of the host plugin API contract
 * (src/features/plugins/plugin.types.ts), synced via `npm run sync-types`.
 * It is the single source of truth for plugin/host type compatibility; edit the host
 * file and re-run the sync instead of changing this file.
 */

import type { ComponentType as ReactComponentType } from "react";
import type { DiagramNodeComponent } from "@/features/canvas";

/**
 * Public surface of the Structura plugin system (RFC:
 * openspec/changes/archive/2026-07-03-add-plugin-system-foundation/design.md).
 * Everything in this file is an API contract versioned by STRUCTURA_PLUGIN_API_VERSION —
 * breaking changes here require a major version bump.
 */

export const STRUCTURA_PLUGIN_API_VERSION = "1.10.0";

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
  "files:folder",
  "llm:context",
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
  /** v1.10 — the catalog service drawn (lambda, dynamodb, …), or null. */
  cloudServiceId: string | null;
  /** v1.10 — the technology label, or null. */
  technology: string | null;
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
  /**
   * Kept when it is a C4 type, `"panel"`, a catalog family category (`"aws-database"`,
   * `"gcp-compute"`, `"oss-messaging"`, …) or a plugin node type `"<pluginId>/<name>"`;
   * anything else, or omitted, becomes `"unknown"`.
   */
  type?: string;
  description?: string;
  /**
   * The component to nest this one in (since 1.3): another input's `key`, or an existing
   * component id from ImportContext. Ignored — the component lands at the top level — when
   * the parent is missing, cannot hold this type, or the parent keys form a cycle.
   */
  parentKey?: string;
  /** Catalog service of a catalog family component, e.g. "dynamodb" (since 1.3). */
  cloudServiceId?: string;
  /** Technology label of a C4 or catalog component (since 1.3). */
  technology?: string;
  /** Relative to the parent when `parentKey` is honoured; otherwise canvas coordinates. */
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

export type PluginPanelSlot =
  | "element-inspector"
  | "services-import"
  /** @deprecated Prefer `services-import`. Accepted for one release. */
  | "service-registry-import"
  | "canvas-toolbar"
  /**
   * v1.4 — a pane docked beside the canvas, opened from a canvas-toolbar toggle titled with
   * the contribution's `title`. One document pane is open at a time.
   */
  | "document-pane";

/**
 * Context handed to every plugin panel, whatever slot it fills. v1.2 unified the former
 * split between inspector and toolbar contexts into this single shape so a `PanelContribution`
 * component is typed the same regardless of slot. Fields that don't apply to a slot are
 * still present with safe values (empty selection / null service on the canvas-toolbar slot).
 */
export interface PluginPanelContext {
  /** Read-only snapshot of the current selection (element-inspector slot; [] elsewhere). */
  selection: readonly PluginComponentSnapshot[];
  /** Read-only snapshot of the service being viewed (services-import slot; null elsewhere). */
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
  /** React component rendered for the node (canvas node-type contract). */
  component: DiagramNodeComponent;
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

/** v1.4 — a problem shown on a line of `CodeEditor`. Lines are 1-based. */
export interface PluginEditorMarker {
  line: number;
  message: string;
  severity: "error" | "warning" | "info";
}

/** v1.4 — props of the host's code editor (`api.ui.CodeEditor`). */
export interface PluginCodeEditorProps {
  value: string;
  /** Monaco language id, e.g. "yaml". */
  language?: string;
  onChange?: (value: string) => void;
  /** Called on Ctrl/Cmd+S inside the editor. */
  onSave?: () => void;
  readOnly?: boolean;
  markers?: readonly PluginEditorMarker[];
  /** CSS height; fills its container by default. */
  height?: string | number;
  /** v1.5 — F2 "Rename symbol" in this editor, answered by the plugin. */
  rename?: PluginEditorRename;
}

/** v1.5 — a symbol the editor can rename, as UTF-16 offsets into the editor's text. */
export interface PluginRenameSymbol {
  start: number;
  end: number;
  text: string;
}

/** v1.5 — what F2 does in a plugin's code editor. */
export interface PluginEditorRename {
  /** The renameable symbol at `offset`, or null when there is none. */
  resolve(offset: number): PluginRenameSymbol | null;
  /**
   * Renames the symbol at `offset` (the plugin applies the change itself, e.g. across files).
   * Resolves to a message to refuse the rename, shown in the editor, or to nothing.
   */
  rename(offset: number, newName: string): void | string | Promise<void | string>;
}

/**
 * v1.4 — capability "files:folder". One folder the user picked: its top-level text files.
 * Names are plain file names; anything that would leave the folder is rejected.
 */
export interface PluginFolder {
  readonly name: string;
  list(): Promise<string[]>;
  /**
   * v1.9 — top-level files with last-modified time (ms) and size, sorted by name: a cheap way
   * to notice changes made outside the app (another editor, git) without reading every file.
   */
  stats(): Promise<Array<{ name: string; lastModified: number; size: number }>>;
  read(fileName: string): Promise<string>;
  write(fileName: string, text: string): Promise<void>;
}

/** v1.6 — what a chat context is told about the turn. */
export interface PluginChatTurnInput {
  diagramId: string;
  /** The app language the reply should be written in. */
  locale: "en" | "pt-BR";
  /** 0 for the user's message; 1, 2… for retries the context asked for. */
  attempt: number;
  maxAttempts: number;
}

/**
 * v1.7 — what a reply changed, shown as pending (highlighted, Keep / Discard) and focused on
 * the canvas until the user decides.
 */
export interface PluginChatPreview {
  /** Components the reply created or changed. */
  componentIds: string[];
  /** Connections the reply created. */
  connectionIds: string[];
  /** Title of the suggestion card in the chat. */
  title: string;
  /** Called on Keep. */
  keep?: () => void;
  /**
   * Called on Discard: undo the reply. Resolve to a message to refuse (it is shown, and the
   * change is kept). Without it, Discard is not offered.
   */
  discard?: () => void | string | Promise<void | string>;
}

/** v1.6 — the outcome of one model reply. */
export interface PluginChatTurnResult {
  /** Text shown in the thread as the assistant's message. */
  reply: string;
  /** v1.7 — the change to show as pending. */
  preview?: PluginChatPreview;
  /**
   * Sent back to the model as the next user turn (not shown), e.g. validation errors to fix.
   * Ignored once `attempt` reaches `maxAttempts - 1`.
   */
  retry?: string;
}

/**
 * v1.6 — capability "llm:context". Takes over the chat for the diagrams it applies to: its
 * system prompt replaces the built-in one and it handles the model's replies itself.
 */
/** v1.8 — how the chat presents itself while a context applies. */
export interface PluginChatPresentation {
  /** Shown in the chat header instead of "Diagram assistant", e.g. "opscr · my-folder". */
  title: string;
  /** Empty-state line under the title. */
  subtitle?: string;
  /** Empty-state suggestions; clicking one sends it as the user's message. */
  suggestions?: string[];
}

export interface PluginChatContext {
  id: string;
  appliesTo(diagramId: string): boolean;
  /** v1.8 — the chat's title and suggestions while this context applies. */
  presentation?(input: { diagramId: string; locale: "en" | "pt-BR" }): PluginChatPresentation;
  /**
   * v1.8 — call `listener` whenever `appliesTo` or `presentation` may answer differently (e.g.
   * a folder was opened), so the chat updates. Returns an unsubscribe function.
   */
  subscribe?(listener: () => void): () => void;
  systemPrompt(input: PluginChatTurnInput): string | Promise<string>;
  handleReply(
    text: string,
    input: PluginChatTurnInput,
  ): PluginChatTurnResult | Promise<PluginChatTurnResult>;
}

/** v1.4 — capability "files:folder". Folders are remembered per plugin and binding id. */
export interface PluginFiles {
  /** False where the browser cannot pick folders (no File System Access API). */
  isSupported(): boolean;
  /** Ask the user for a folder and remember it under `bindingId`. Null if cancelled. */
  pick(bindingId: string): Promise<PluginFolder | null>;
  /**
   * The folder remembered under `bindingId`, once the user grants permission again (the
   * browser may prompt, so call it from a user gesture). Null when there is none.
   */
  open(bindingId: string): Promise<PluginFolder | null>;
  forget(bindingId: string): Promise<void>;
}

/** v1.4 — changes to the ACTIVE diagram applied as one history step (`applyChanges`). */
export interface PluginDiagramChanges {
  /** Component ids to remove, with their connections. */
  remove?: string[];
  /** Connection ids to remove. */
  disconnect?: string[];
  update?: Array<{
    id: string;
    name?: string;
    description?: string;
    technology?: string;
    /** Catalog service; "" clears it. */
    cloudServiceId?: string;
  }>;
  move?: Array<{ id: string; x: number; y: number; width?: number; height?: number }>;
  /** New components, as importers return them (type policy and nesting included). */
  add?: PluginComponentInput[];
  /** New connections; ends are `add` keys or existing component ids. */
  connect?: PluginConnectionInput[];
}

export interface PluginDiagramChangesResult {
  /** The component id created for each `add` key. */
  idsByKey: Record<string, string>;
  /** Per `connect` entry, in order: the connection created, or null when its ends did not resolve. */
  connectionIds: Array<string | null>;
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

  /**
   * v1.4 — capability "diagram:write". Remove, update, move, add and connect on the ACTIVE
   * diagram as one history step. Ids not in the diagram are ignored.
   */
  applyChanges(changes: PluginDiagramChanges): PluginDiagramChangesResult;

  /** v1.4 — capability "files:folder". Folders the user picked for this plugin. */
  readonly files: PluginFiles;

  /**
   * v1.6 — capability "llm:context". Provide the chat's context and reply handling for the
   * diagrams `context.appliesTo` accepts. Unregistered when the plugin deactivates.
   */
  registerChatContext(context: PluginChatContext): void;

  /** v1.4 — host UI building blocks plugins render instead of bundling their own. */
  readonly ui: {
    /** The host's code editor (Monaco, loaded on first render). */
    CodeEditor: ReactComponentType<PluginCodeEditorProps>;
  };

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
