import React from "react";
import * as JsxRuntime from "react/jsx-runtime";
import * as JsxDevRuntime from "react/jsx-dev-runtime";

/**
 * The host's own React instance and JSX runtimes, exposed on `window` so that plugin
 * bundles can bind to them as build-time externals (RFC D4 dependency sharing).
 *
 * A plugin's `vite.config` marks `react` / `react/jsx-runtime` as external and maps them
 * to these globals, so the plugin's compiled IIFE reuses the host's SINGLE React instance
 * instead of bundling its own. One React instance is what makes hooks work across the
 * host/plugin boundary — two copies of React silently break `useState`/`useEffect`.
 *
 * This replaces the old `api.dependencies.react` + `getReact()` threading: with the global
 * in place, plugin authors write ordinary React (`import { useState } from "react"`, JSX
 * with the automatic runtime) and never touch a host-provided React handle.
 *
 * The names are part of the plugin build contract — changing them breaks already-built
 * plugin bundles, so they are versioned with STRUCTURA_PLUGIN_API_VERSION.
 */
export const PLUGIN_REACT_GLOBAL = "__REACT__";
export const PLUGIN_JSX_RUNTIME_GLOBAL = "__REACT_JSX_RUNTIME__";
export const PLUGIN_JSX_DEV_RUNTIME_GLOBAL = "__REACT_JSX_DEV_RUNTIME__";

declare global {
  interface Window {
    [PLUGIN_REACT_GLOBAL]?: typeof React;
    [PLUGIN_JSX_RUNTIME_GLOBAL]?: typeof JsxRuntime;
    [PLUGIN_JSX_DEV_RUNTIME_GLOBAL]?: typeof JsxDevRuntime;
  }
}

let installed = false;

/**
 * Publish the host React + JSX runtimes as globals. Idempotent, and safe to call before
 * every plugin execution — plugins are executed via `new Function` (no module system at
 * runtime), so their externals resolve against these globals in the surrounding scope.
 */
export function installPluginRuntimeGlobals(): void {
  if (installed) return;
  window[PLUGIN_REACT_GLOBAL] = React;
  window[PLUGIN_JSX_RUNTIME_GLOBAL] = JsxRuntime;
  window[PLUGIN_JSX_DEV_RUNTIME_GLOBAL] = JsxDevRuntime;
  installed = true;
}
