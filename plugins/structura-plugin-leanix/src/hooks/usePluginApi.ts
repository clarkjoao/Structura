import type { StructuraPluginApi, ToastOptions, ModalOptions } from "../types/plugin.types";

/**
 * The host passes the plugin API to `activate()`. We stash it here so components can reach
 * host capabilities (storage, diagram reads, overlays) without prop-drilling the API through
 * every panel. React itself is NOT threaded through here — the host shares its React instance
 * as a build-time external, so components just `import { useState } from "react"`.
 */
let pluginApi: StructuraPluginApi | null = null;

/** Called once from `activate()` with the host-provided API. */
export function initializePlugin(api: StructuraPluginApi): void {
  pluginApi = api;
}

/** The host plugin API. Throws if read before `activate()` ran. */
export function getApi(): StructuraPluginApi {
  if (!pluginApi) {
    throw new Error(
      "[Leanix Plugin] Plugin API not initialized — call initializePlugin(api) in activate().",
    );
  }
  return pluginApi;
}

/** Show a toast notification (requires the ui:overlays capability). */
export function showToast(options: ToastOptions): void {
  getApi().overlay.showToast(options);
}

/** Open a modal dialog (requires the ui:overlays capability). */
export function openModal(options: ModalOptions): void {
  getApi().overlay.openModal(options);
}
