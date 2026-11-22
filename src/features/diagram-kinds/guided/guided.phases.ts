import type { Component } from "@/features/diagram/model/component.types";
import { type GuidedReading, forwardGraph, readingOrder } from "./guided.model";

/**
 * Journey phases (spec guided-journey-phases). A phase starts at a step
 * (`kindProps.phase`) and runs on through the steps after it until the next
 * start: there is no phase list to keep in sync, the starts are the list.
 */

/** The phase a step starts, trimmed; null when it starts none. */
export function phaseStartOf(component: Component): string | null {
  const value = component.kindProps?.phase;
  if (typeof value !== "string") return null;
  const name = value.trim();
  return name ? name : null;
}

export interface GuidedPhase {
  name: string;
  startId: string;
}

export interface GuidedPhases {
  /** The phases, in reading order of their starts. */
  phases: GuidedPhase[];
  /** Each step's phase index; absent: before every start. */
  phaseOf: Map<string, number>;
}

/**
 * Each step's phase: its own start, else the latest phase among its forward
 * predecessors (back-edges, the retries, do not carry a phase back).
 */
export function guidedPhases(
  reading: GuidedReading,
  graph: Pick<ReturnType<typeof forwardGraph>, "forward" | "topo"> = forwardGraph(reading),
): GuidedPhases {
  const phases: GuidedPhase[] = [];
  const indexOfStart = new Map<string, number>();
  for (const id of readingOrder(reading)) {
    const name = phaseStartOf(reading.steps.get(id)!);
    if (!name) continue;
    indexOfStart.set(id, phases.length);
    phases.push({ name, startId: id });
  }
  const phaseOf = new Map<string, number>();
  if (phases.length === 0) return { phases, phaseOf };
  const inherited = new Map<string, number>();
  for (const id of graph.topo) {
    const own = indexOfStart.get(id);
    const phase = own ?? inherited.get(id);
    if (phase === undefined) continue;
    phaseOf.set(id, phase);
    for (const target of graph.forward.get(id) ?? [])
      inherited.set(target, Math.max(inherited.get(target) ?? -1, phase));
  }
  return { phases, phaseOf };
}
