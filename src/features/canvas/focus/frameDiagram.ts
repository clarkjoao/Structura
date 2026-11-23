import { useCallback } from "react";
import {
  getViewportForBounds,
  useReactFlow,
  useStoreApi,
  type FitViewOptions,
  type ReactFlowInstance,
} from "@xyflow/react";
import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import type { KindOverlay } from "@/features/diagram-kinds/kind.types";
import { kindOverlayFor } from "@/features/diagram-kinds/overlay";
import { overlayBounds, unionRect } from "@/features/diagram-kinds/overlay.geometry";

export type FrameDiagramOptions = Pick<
  FitViewOptions,
  "padding" | "duration" | "minZoom" | "maxZoom"
>;

type FrameInstance = Pick<
  ReactFlowInstance,
  "fitView" | "getNodes" | "getNodesBounds" | "setViewport"
>;

interface FramePane {
  width: number;
  height: number;
  minZoom: number;
  maxZoom: number;
}

/** The active diagram's kind overlay (the phase band), if it draws one. */
export function activeKindOverlay(): KindOverlay | null {
  const state = useDiagramStore.getState();
  return kindOverlayFor(state.activeDiagramId ? state.diagrams[state.activeDiagramId] : null);
}

/**
 * Frames the whole diagram (spec guided-overlay-fit-export): the nodes and
 * the kind overlay beside them, which takes no layout room and so is unknown
 * to React Flow's own fit. Without an overlay it is exactly `fitView`.
 */
export function frameDiagram(
  instance: FrameInstance,
  pane: FramePane,
  overlay: KindOverlay | null,
  options: FrameDiagramOptions = {},
): Promise<boolean> {
  const extra = overlay ? overlayBounds(overlay) : null;
  if (!extra) return instance.fitView(options);
  const nodes = instance.getNodes().filter((node) => !node.hidden);
  const bounds = unionRect(nodes.length > 0 ? instance.getNodesBounds(nodes) : null, extra)!;
  const viewport = getViewportForBounds(
    bounds,
    pane.width,
    pane.height,
    options.minZoom ?? pane.minZoom,
    options.maxZoom ?? pane.maxZoom,
    options.padding ?? 0.1,
  );
  return instance.setViewport(viewport, { duration: options.duration ?? 0 });
}

/** `frameDiagram` for the canvas under the current React Flow provider. */
export function useFrameDiagram(): (options?: FrameDiagramOptions) => Promise<boolean> {
  const instance = useReactFlow();
  const store = useStoreApi();
  return useCallback(
    (options?: FrameDiagramOptions) =>
      frameDiagram(instance, store.getState(), activeKindOverlay(), options),
    [instance, store],
  );
}
