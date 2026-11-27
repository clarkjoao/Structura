import type { PluginLayout } from "./types/plugin.types";
import { placeViewWith, type TechnicalView, type ViewLayoutResult } from "./opscr-mapping";

/**
 * Placement is the host's (`api.layout.place`, API 1.21): the plugin neither sizes nor
 * positions anything. `activate` hands the host's layout over before anything can project a
 * workspace; tests install the host's own implementation through `test/host-layout.setup.ts`.
 */
let engine: PluginLayout | undefined;

/** Installs the host's layout; returns the one it replaces. */
export function setHostLayout(layout: PluginLayout): PluginLayout | undefined {
  const previous = engine;
  engine = layout;
  return previous;
}

/**
 * The view placed by Structura (`placeViewWith`): arranged as the canvas's Arrange when nothing is
 * drawn, else kept where it is drawn with each new element placed as the canvas's automatic mode
 * places it. `diagramId` names the diagram it is for — its reading direction and Arrange settings.
 */
export async function placeWorkspaceView(
  view: TechnicalView,
  previous?: ViewLayoutResult,
  diagramId?: string,
): Promise<ViewLayoutResult> {
  const host = engine;
  if (!host) throw new Error("[opscr] the host's layout is not set: activate first");
  return placeViewWith(
    { place: (input) => host.place({ ...input, ...(diagramId && { diagramId }) }) },
    view,
    previous,
  );
}
