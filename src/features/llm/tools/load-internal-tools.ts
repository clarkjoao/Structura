import type { ToolRegistry } from "./registry";

/** The tools every turn offers the model. */
let internalTools: Promise<ToolRegistry> | null = null;

/**
 * The internal tool registry, loaded on first use (the first turn, or the
 * skills settings): the tools carry zod schemas, which stay out of the
 * initial bundle with the rest of the chat runtime.
 */
export function loadInternalTools(): Promise<ToolRegistry> {
  internalTools ??= import("./internal-tools").then((module) =>
    module.createInternalToolRegistry(),
  );
  return internalTools;
}
