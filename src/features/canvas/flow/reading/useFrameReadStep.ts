import { useEffect } from "react";
import { useStore, type ReactFlowInstance } from "@xyflow/react";
import { getStepById, type Flow, type FlowStep } from "@/features/diagram";
import { FIT_VIEW_DURATION_MS, FIT_VIEW_MAX_ZOOM, FIT_VIEW_PADDING } from "../../canvas.constants";

interface Params {
  reactFlowInstance: ReactFlowInstance;
  /** True while a script is being read. */
  isReading: boolean;
  flow: Flow | null | undefined;
  currentStepId: string | null | undefined;
}

/**
 * What the step points at on the canvas, as node ids.
 *
 * A call frames both of its ends, because a call is the pair and framing one
 * of them hides who it is talking to.
 */
function targetsOf(step: FlowStep, instance: ReactFlowInstance): string[] | null {
  if (step.componentId) return instance.getNode(step.componentId) ? [step.componentId] : null;

  if (!step.connectionId) return null;
  const edge = instance.getEdge(step.connectionId);
  if (!edge) return null;
  return instance.getNode(edge.source) && instance.getNode(edge.target)
    ? [edge.source, edge.target]
    : null;
}

/**
 * Brings what the step points at into view, as the reader moves through it.
 *
 * Without it the reader is told about a node and left to find it: the reading
 * says "Redirect API" and the canvas stays wherever it was, often with that
 * node off-screen entirely. It lived in the editor's canvas effects, where the
 * viewer could not reach it — which is exactly why a shared diagram stepped
 * through a script without ever moving.
 */
export function useFrameReadStep({
  reactFlowInstance,
  isReading,
  flow,
  currentStepId,
}: Params): void {
  const paneWidth = useStore((state) => state.width);

  useEffect(() => {
    if (!isReading || !flow || !currentStepId) return;
    const step = getStepById(flow, currentStepId);
    if (!step) return;

    let cancelled = false;
    // `paneWidth` is a dependency, not a value used here: opening the reading
    // rail narrows the canvas, and framing a step against the width it had a
    // moment ago puts it half a rail off centre. The width arrives through a
    // ResizeObserver, so it lands a beat after this effect first runs and this
    // run is cancelled in favour of one that measures the canvas it now has.
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (cancelled) return;
        const targets = targetsOf(step, reactFlowInstance);
        if (!targets) return;

        void reactFlowInstance.fitView({
          nodes: targets.map((nodeId) => ({ id: nodeId })),
          duration: FIT_VIEW_DURATION_MS,
          padding: FIT_VIEW_PADDING,
          maxZoom: FIT_VIEW_MAX_ZOOM,
        });
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [isReading, flow, currentStepId, paneWidth, reactFlowInstance]);
}
