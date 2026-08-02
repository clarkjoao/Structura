/**
 * Validator entry point.
 *
 * Two stages, matching where the information becomes available:
 *
 *   `validateStructure` runs on the IR, before the engine does any work. It is cheap and
 *   catches the errors that would make every geometric finding meaningless.
 *
 *   `validateGeometry` runs on the engine's output.
 *
 * Diagnostics come back in repair order (structural first), so a caller working top-down
 * fixes causes before symptoms.
 */

import type { LayoutState } from "../layout-engine/types";
import {
  validateBoundaries,
  validateComposition,
  validateEdges,
  validateFlow,
  validateLabels,
  validateNodes,
  validateAwsServiceNames,
  scoreReadability,
} from "./geometric";
import { validateStructure, type StructuralInput } from "./structural";
import { sortByRepairOrder, type Diagnostic, type ValidationReport } from "./types";

export * from "./types";
export * from "./geometry";
export { validateStructure } from "./structural";
export type { StructuralInput } from "./structural";
export {
  validateNodes,
  validateBoundaries,
  validateEdges,
  validateLabels,
  validateFlow,
  validateComposition,
  validateAwsServiceNames,
  scoreReadability,
} from "./geometric";

function summarise(diagnostics: Diagnostic[], state?: LayoutState): ValidationReport {
  const ordered = sortByRepairOrder(diagnostics);
  return {
    diagnostics: ordered,
    errors: ordered.filter((d) => d.severity === "error").length,
    warnings: ordered.filter((d) => d.severity === "warning").length,
    readability: state
      ? scoreReadability(state)
      : { throughVertexRoutes: 0, edgeCrossings: 0, totalEdgeLength: 0, score: 0 },
  };
}

/** Stage 1 — structural checks on the IR, before layout. */
export function validateIr(ir: StructuralInput): ValidationReport {
  return summarise(validateStructure(ir));
}

/** Stage 2 — geometric and semantic checks on laid-out geometry. */
export function validateGeometry(state: LayoutState): ValidationReport {
  return summarise(
    [
      ...validateNodes(state),
      ...validateBoundaries(state),
      ...validateEdges(state),
      ...validateLabels(state),
      ...validateFlow(state),
      ...validateComposition(state),
      ...validateAwsServiceNames(state),
    ],
    state,
  );
}
