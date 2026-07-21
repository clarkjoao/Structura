import type ReactType from "react";
import type { StructuraPluginApi, ToastOptions } from "../types/plugin";

/**
 * Global reference to the plugin API set during activation
 */
let pluginApi: StructuraPluginApi | null = null;

/**
 * Global reference to React from the host (set via window after activation)
 */
let react: typeof ReactType | null = null;

/**
 * Initialize the plugin API and React
 * Called during activation with the API from the host
 */
export function initializePlugin(api: StructuraPluginApi): void {
  pluginApi = api;

  // Get React from host via dependencies
  // Note: For IIFE plugins, we need to store it for later component use
  react = (api.dependencies?.react as typeof ReactType | undefined) ?? null;

  if (!react) {
    console.error("[Example Plugin] React not available. Please ensure the host provides React.");
  }
}

/**
 * Check if React is available from the host
 */
export function hasReact(): boolean {
  return react !== null;
}

/**
 * Get the React library from the host
 * @throws if React not available
 */
export function getReact(): typeof ReactType {
  if (!react) {
    throw new Error("[Example Plugin] React not available.");
  }
  return react;
}

/**
 * Get the plugin API
 * @throws if API not initialized
 */
export function getApi(): StructuraPluginApi {
  if (!pluginApi) {
    throw new Error("[Example Plugin] Plugin API not initialized.");
  }
  return pluginApi;
}

/**
 * Hook to access plugin API with React
 * Returns [React, API] tuple
 */
export function usePluginApi(): [typeof ReactType, StructuraPluginApi] {
  return [getReact(), getApi()];
}

/**
 * Show a toast notification
 */
export function showToast(options: ToastOptions): void {
  getApi().overlay.showToast(options);
}

/**
 * Open a modal dialog
 */
export function openModal(options: Parameters<StructuraPluginApi["overlay"]["openModal"]>[0]): void {
  getApi().overlay.openModal(options);
}
