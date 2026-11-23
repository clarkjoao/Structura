import { useEffect } from "react";
import { getViewportForBounds, useStore, type ReactFlowInstance } from "@xyflow/react";
import { getStepById, type Flow, type FlowStep } from "@/features/diagram";
import { FIT_VIEW_DURATION_MS } from "../../canvas.constants";
import {
  neighbourSteps,
  planReadingFrame,
  READING_MAX_ZOOM,
  READING_PADDING,
} from "./readingFrame";
import { useFlowViewStore } from "../useFlowViewStore";

/** Only for a step too big to fit at a reading zoom: it is still shown whole. */
const STEP_ALONE_MIN_ZOOM = 0.1;

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
interface StepTargets {
  ids: string[];
  /** The node the step happens on: where its call arrives, or else its component. */
  focus: string;
}

function targetsOf(step: FlowStep, instance: ReactFlowInstance): StepTargets | null {
  const ids = new Set<string>();
  const component = step.componentId ? drawnNodeId(step.componentId, instance) : null;
  if (component) ids.add(component);
  // A step can name both its component and the call it makes: the call's far end is part of
  // the step too, or a step "on DICT Client calling SPI" frames DICT Client and leaves SPI off.
  let arrival: string | null = null;
  if (step.connectionId) {
    const edge = instance.getEdge(step.connectionId);
    const source = edge ? drawnNodeId(edge.source, instance) : null;
    const target = edge ? drawnNodeId(edge.target, instance) : null;
    if (source && target) {
      ids.add(source);
      ids.add(target);
      // A response travels the call's edge backwards, as `describeStepTarget` reads it.
      arrival = step.payloadDirection === "response" ? source : target;
    }
  }
  // The same node the rail names after "on": where the call arrives, else the component.
  const focus = arrival ?? component;
  return focus ? { ids: [...ids], focus } : null;
}

/** Every node a step points at on the canvas (see `targetsOf`). */
export function stepTargetIds(step: FlowStep, instance: ReactFlowInstance): string[] {
  return targetsOf(step, instance)?.ids ?? [];
}

/**
 * The node on screen for `nodeId`: itself, or — hidden inside a compact
 * container — the first ancestor that is drawn. (An ancestor above a drawn one
 * is never hidden: hiding a container hides everything in it.)
 */
function drawnNodeId(nodeId: string, instance: ReactFlowInstance): string | null {
  let node = instance.getNode(nodeId);
  const seen = new Set<string>();
  while (node && node.hidden && node.parentId && !seen.has(node.id)) {
    seen.add(node.id);
    node = instance.getNode(node.parentId);
  }
  return node && !node.hidden ? node.id : null;
}

/**
 * Brings what the step points at into view, as the reader moves through it — with its neighbours,
 * at a reading zoom, and only when it is not already comfortably on screen (see `readingFrame`).
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
  const paneHeight = useStore((state) => state.height);
  const cameraLocked = useFlowViewStore((state) => state.cameraLocked);

  useEffect(() => {
    if (!isReading || cameraLocked || !flow || !currentStepId) return;
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
        const neighbours = neighbourSteps(flow, currentStepId).flatMap(
          (neighbour) => targetsOf(neighbour, reactFlowInstance)?.ids ?? [],
        );
        const pane = { width: paneWidth, height: paneHeight };
        const plan = planReadingFrame({
          step: reactFlowInstance.getNodesBounds(targets.ids),
          focus: reactFlowInstance.getNodesBounds([targets.focus]),
          context: neighbours.length > 0 ? reactFlowInstance.getNodesBounds(neighbours) : null,
          viewport: reactFlowInstance.getViewport(),
          pane,
        });
        if (plan.kind === "stay") return;

        void reactFlowInstance.setViewport(
          getViewportForBounds(
            plan.bounds,
            pane.width,
            pane.height,
            STEP_ALONE_MIN_ZOOM,
            READING_MAX_ZOOM,
            READING_PADDING,
          ),
          { duration: FIT_VIEW_DURATION_MS },
        );
      });
    });

    return () => {
      cancelled = true;
      cancelAnimationFrame(id);
    };
  }, [isReading, cameraLocked, flow, currentStepId, paneWidth, paneHeight, reactFlowInstance]);
}
