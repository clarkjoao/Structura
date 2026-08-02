/**
 * Validator diagnostics.
 *
 * A diagnostic is written for the model to act on, so every field is about the IR, never
 * about pixels. `supportedFixes` in particular must only propose IR-level edits — move a
 * node to another tier, split a boundary, shorten a label. Proposing "move it 120px down"
 * would hand geometry back to the model, which is the failure this whole subsystem exists
 * to remove.
 */

export type Severity = "error" | "warning";

export type SubjectKind = "node" | "edge" | "boundary" | "label";

/**
 * IR-level repair actions. The list is closed on purpose: a new kind of fix should be a
 * deliberate addition, not an ad-hoc string invented at a call site.
 */
export type FixAction =
  | "rename-id"
  | "remove-duplicate"
  | "move-tier"
  | "split-boundary"
  | "remove-boundary"
  | "assign-boundary"
  | "unassign-boundary"
  | "drop-edge"
  | "add-edge"
  | "shorten-label"
  | "remove-label"
  | "reduce-nodes"
  | "mark-cross-cutting"
  | "reverse-edge"
  | "increase-density"
  | "set-aws-service";

export interface SupportedFix {
  action: FixAction;
  /** What to change, in IR terms, naming the real elements involved. */
  description: string;
  /** Optional patch the caller can apply directly to the IR. */
  ir_patch?: unknown;
}

export interface Diagnostic {
  code: string;
  severity: Severity;
  /** Readable by the model, using real element names rather than ids alone. */
  message: string;
  subject: { kind: SubjectKind; ids: string[] };
  /** Measurements backing the finding, so the model can judge severity itself. */
  evidence?: Record<string, number | string>;
  supportedFixes: SupportedFix[];
}

/**
 * Repair order. Structural problems come first: an unknown id invalidates every geometric
 * finding downstream of it, so fixing those first avoids chasing derived symptoms.
 */
export const REPAIR_ORDER = ["ir", "node", "boundary", "edge", "label", "flow", "c4"] as const;

export type DiagnosticCategory = (typeof REPAIR_ORDER)[number];

/** Category of a diagnostic code (`node/overlap` -> `node`). */
export function categoryOf(code: string): DiagnosticCategory {
  const prefix = code.split("/")[0] as DiagnosticCategory;
  return REPAIR_ORDER.includes(prefix) ? prefix : "ir";
}

/** Sorts diagnostics into repair order, errors before warnings within a category. */
export function sortByRepairOrder(diagnostics: readonly Diagnostic[]): Diagnostic[] {
  return [...diagnostics].sort((a, b) => {
    const categoryDelta =
      REPAIR_ORDER.indexOf(categoryOf(a.code)) - REPAIR_ORDER.indexOf(categoryOf(b.code));
    if (categoryDelta !== 0) return categoryDelta;
    if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;
    return a.code.localeCompare(b.code);
  });
}

/**
 * Readability score. Lower is better.
 *
 * Weights come from drawio-skill's `--score`: an edge running through a node hurts
 * comprehension far more than two edges crossing, and total edge length only breaks ties.
 * Reported alongside diagnostics; it never blocks.
 */
export interface ReadabilityScore {
  throughVertexRoutes: number;
  edgeCrossings: number;
  totalEdgeLength: number;
  score: number;
}

export const SCORE_WEIGHTS = {
  THROUGH_VERTEX: 20,
  CROSSING: 10,
  LENGTH: 0.001,
} as const;

export interface ValidationReport {
  diagnostics: Diagnostic[];
  errors: number;
  warnings: number;
  readability: ReadabilityScore;
}
