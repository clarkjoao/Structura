// Plugin registry and types
export { usePluginRegistry } from "./store/plugins.store";
export type {
  PluginManifest,
  ImporterContribution,
  ExporterContribution,
  PluginPanelSlot,
  DiagramSnapshot,
  PluginComponentSnapshot,
  PluginConnectionSnapshot,
  PluginServiceSnapshot,
  PluginComponentPatch,
  PluginServicePatch,
  PluginComponentInput,
  PluginConnectionInput,
  ImportContext,
  ImportResult,
  LocalizedText,
} from "./plugin.types";
export type { ManifestValidationError } from "./manifest-validation";

// IO contributions (import/export)
export { usePluginIoContributions } from "./use-plugin-contributions";

// Localized text resolution
export { resolveLocalizedText } from "./localized-text";

// Plugin loader
export { runPluginImport } from "./run-plugin-import";
