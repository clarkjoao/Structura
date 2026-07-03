import type { PluginDefinition, StructuraPluginGlobal } from "./plugin.types";

declare global {
  interface Window {
    StructuraPlugin?: StructuraPluginGlobal;
  }
}

export type PluginLoadErrorCode = "no-define" | "multiple-define" | "execution-error";

export class PluginLoadError extends Error {
  readonly code: PluginLoadErrorCode;
  readonly cause?: unknown;

  constructor(code: PluginLoadErrorCode, message: string, cause?: unknown) {
    super(message);
    this.name = "PluginLoadError";
    this.code = code;
    this.cause = cause;
  }
}

/**
 * Execute a plugin file's code (no sandbox — install is consent, RFC D6) with the
 * `window.StructuraPlugin.define` capture hook installed for the duration of the run.
 * Exactly one `define()` call is the contract (RFC D1); anything else throws
 * PluginLoadError and leaves no trace.
 */
export function executePluginCode(code: string): PluginDefinition {
  const captured: PluginDefinition[] = [];
  const hook: StructuraPluginGlobal = {
    define(definition: PluginDefinition) {
      captured.push(definition);
    },
  };

  const previous = window.StructuraPlugin;
  window.StructuraPlugin = hook;
  try {
    const run = new Function(code);
    run();
  } catch (error) {
    throw new PluginLoadError(
      "execution-error",
      "Plugin file threw while executing at top level.",
      error,
    );
  } finally {
    window.StructuraPlugin = previous;
  }

  if (captured.length === 0) {
    throw new PluginLoadError("no-define", "Plugin file never called StructuraPlugin.define().");
  }
  if (captured.length > 1) {
    throw new PluginLoadError(
      "multiple-define",
      "Plugin file called StructuraPlugin.define() more than once.",
    );
  }
  return captured[0];
}
