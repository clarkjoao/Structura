import type { ViewPlacer } from "./generated/opscr-mapping";

/**
 * Tests only: the engine the extension lays out with is Structura's, reached through the webview
 * at run time. Tests use the same implementation the webview answers with — the host's
 * `api.layout` (its `place`) — installed by `test/host-layout.setup.ts`, which reads it from the host's source.
 */
let engine: ViewPlacer | undefined;

export function setHostEngine(next: ViewPlacer): void {
  engine = next;
}

export function hostEngine(): ViewPlacer {
  if (!engine) throw new Error("test/host-layout.setup.ts did not install the host's engine");
  return engine;
}
