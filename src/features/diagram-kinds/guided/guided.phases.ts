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
  /** The phase each step would be in without its own start; absent: none. */
  inheritedOf: Map<string, number>;
}

/**
 * Each step's phase: its own start, else the latest phase among its forward
 * predecessors (back-edges, the retries, do not carry a phase back). A start
 * naming the phase the step is already in opens nothing: it continues it.
 */
export function guidedPhases(
  reading: GuidedReading,
  graph: Pick<ReturnType<typeof forwardGraph>, "forward" | "topo"> = forwardGraph(reading),
): GuidedPhases {
  const starts: GuidedPhase[] = [];
  const indexOfStart = new Map<string, number>();
  for (const id of readingOrder(reading)) {
    const name = phaseStartOf(reading.steps.get(id)!);
    if (!name) continue;
    indexOfStart.set(id, starts.length);
    starts.push({ name, startId: id });
  }
  const phaseOf = new Map<string, number>();
  const inheritedOf = new Map<string, number>();
  if (starts.length === 0) return { phases: starts, phaseOf, inheritedOf };
  for (const id of graph.topo) {
    const inherited = inheritedOf.get(id);
    let phase = indexOfStart.get(id) ?? inherited;
    if (phase === undefined) continue;
    if (inherited !== undefined && starts[phase]!.name === starts[inherited]!.name)
      phase = inherited;
    phaseOf.set(id, phase);
    for (const target of graph.forward.get(id) ?? [])
      inheritedOf.set(target, Math.max(inheritedOf.get(target) ?? -1, phase));
  }
  // Keep only the starts that open a phase, in reading order, and renumber.
  const used = [...new Set(phaseOf.values())].sort((a, b) => a - b);
  if (used.length === starts.length) return { phases: starts, phaseOf, inheritedOf };
  const renumber = new Map(used.map((index, i) => [index, i]));
  const remap = (map: Map<string, number>) => {
    for (const [id, index] of map) map.set(id, renumber.get(index)!);
  };
  remap(phaseOf);
  remap(inheritedOf);
  return { phases: used.map((index) => starts[index]!), phaseOf, inheritedOf };
}

/** The distinct phase names, in reading order of their first start. */
export function guidedPhaseNames(phases: readonly GuidedPhase[]): string[] {
  return [...new Set(phases.map((phase) => phase.name))];
}
