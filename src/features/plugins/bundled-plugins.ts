import { bundledPlugins } from "virtual:structura-bundled-plugins";

/**
 * Plugins compiled into this build ("built-in" layer). Unlike user plugins, these are NOT
 * uploaded and NOT persisted to `plugins:installed`; the source of truth is the app bundle,
 * so a rebuild that ships a newer plugin version updates them automatically.
 *
 * The array is produced at build time by the `virtual:structura-bundled-plugins` Vite module
 * (see vite.config.ts + tools/build-with-plugins.mjs). It is empty for a plain `npm run build`.
 * Kept behind this thin accessor so tests can mock the (build-only) virtual module.
 */
export interface BundledPlugin {
  /** Source folder name under plugins/, used only for diagnostics. */
  dir: string;
  /** The built IIFE bundle (dist/plugin.js) as a string, executed like an uploaded plugin. */
  code: string;
}

export function getBundledPlugins(): BundledPlugin[] {
  return bundledPlugins;
}
