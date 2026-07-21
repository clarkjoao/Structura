import type { ReactElement } from "react";

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
  content: (props: { onClose: () => void }) => ReactElement;
  size?: "sm" | "md" | "lg";
}

/**
 * Panel contribution registered by the plugin
 */
export interface PanelContribution {
  id: string;
  slot: PluginPanelSlot;
  title: LocalizedText;
  component: (props: { context: PanelContext }) => ReactElement;
}

/**
 * Supported panel slots
 */
export type PluginPanelSlot = "canvas-toolbar" | "element-inspector";

/**
 * Context passed to panel components
 */
export interface PanelContext {
  locale: string;
  isEditMode: boolean;
  selection?: PanelComponentSnapshot[];
}

/**
 * Read-only snapshot of a diagram component
 */
export interface PanelComponentSnapshot {
  id: string;
  type: string;
  label: string;
  description: string;
  tags: readonly string[];
}

/**
 * Read-only snapshot of a diagram
 */
export interface DiagramSnapshot {
  name: string;
  components: unknown[];
  connections: unknown[];
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
