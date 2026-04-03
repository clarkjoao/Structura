import type { Flow, Diagram } from "@/features/diagram";
import { validateFlowGraph } from "@/features/diagram";
export type { BrokenStep } from "@/features/diagram";

export function validateFlow(flow: Flow, diagram: Diagram) {
  return validateFlowGraph(flow, diagram);
}
