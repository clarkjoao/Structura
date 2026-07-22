/**
 * Plugin manifest declaration
 */
export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  author: string;
  description: string;
  apiVersion: string;
  capabilities: string[];
  uses?: string[];
}

/**
 * Toast notification options
 */
export interface ToastOptions {
  type: "success" | "error" | "info" | "warning";
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  duration?: number;
}

/**
 * Modal dialog options
 */
export interface ModalOptions {
  title: string;
  content: (props: { onClose: () => void }) => React.ReactElement;
  size?: "sm" | "md" | "lg";
}

/**
 * Panel contribution registered by the plugin
 */
export interface PanelContribution {
  id: string;
  slot: PluginPanelSlot;
  title: LocalizedText;
  component: React.ComponentType<PluginPanelProps>;
}

/**
 * Supported panel slots
 */
export type PluginPanelSlot = "canvas-toolbar" | "element-inspector" | "service-registry-import";

/**
 * Read-only snapshot of a diagram component
 */
export interface PluginComponentSnapshot {
  id: string;
  type: string;
  label: string;
  description: string;
  tags: readonly string[];
  parentId: string | null;
  position: { x: number; y: number } | null;
  size: { width: number; height: number } | null;
  serviceId: string | null;
}

/**
 * Read-only snapshot of a diagram
 */
export interface DiagramSnapshot {
  id: string;
  name: string;
  description: string | null;
  components: readonly PluginComponentSnapshot[];
  connections: readonly PluginConnectionSnapshot[];
}

/**
 * Read-only connection snapshot
 */
export interface PluginConnectionSnapshot {
  id: string;
  sourceId: string;
  targetId: string;
  label: string;
  description: string | null;
  technology: string | null;
}

/**
 * Context passed to panel components (canvas-toolbar slot)
 */
export interface PluginPanelProps {
  context: PluginToolbarContext;
}

/**
 * Context provided to canvas-toolbar slot panels
 */
export interface PluginToolbarContext {
  /** Current locale ("en" | "pt-BR") */
  locale: string;
  /** Whether the user is in edit mode */
  isEditMode: boolean;
}

/**
 * Localized text (supports en and pt-BR)
 */
export interface LocalizedText {
  en: string;
  "pt-BR"?: string;
}

/**
 * Main plugin API provided by the host
 */
export interface StructuraPluginApi {
  /** Host-provided dependencies (e.g., React) */
  dependencies: {
    react?: unknown;
  };

  /** Overlay capabilities for toasts and modals */
  overlay: {
    showToast(options: ToastOptions): void;
    openModal(options: ModalOptions): void;
  };

  /** Register a panel contribution */
  registerPanel(section: PanelContribution): void;

  /** Subscribe to diagram changes */
  onDiagramChange(callback: (diagramId: string) => void): () => void;

  /** Get the active diagram ID */
  getActiveDiagramId(): string | null;

  /** Get a diagram by ID */
  getDiagram(diagramId?: string): DiagramSnapshot | null;
}
