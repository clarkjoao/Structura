/**
 * Proposal session — the propose / refine / commit loop.
 *
 * Proposing and committing are separate on purpose. The old surface mutated the store on
 * every `add_node`, so a diagram was already half-built before anything could check it, and
 * three rounds of correction meant three partial diagrams on the canvas. Here a proposal
 * produces geometry and diagnostics without touching the store; only `commit` applies it.
 *
 * The loop is capped at MAX_ROUNDS and additionally stops when it stops improving: two
 * consecutive rounds that fail to beat the best error count mean the model is circling, and
 * more rounds only cost tokens.
 */

import { layoutDiagram, type LayoutResult, type MeasureText } from "@/lib/layout-engine";
import {
  validateGeometry,
  validateIr,
  type Diagnostic,
  type ValidationReport,
} from "@/lib/validators";
import { parseArchitectureIr, toLayoutInput, toStructuralInput } from "./ir";
import type { ArchitectureIr } from "./ir";

/** Hard cap on correction rounds. */
export const MAX_ROUNDS = 3;

/** Consecutive non-improving rounds tolerated before the loop gives up. */
export const STALL_LIMIT = 2;

export type ProposalStatus =
  | "ok"
  | "schema-invalid"
  | "structurally-invalid"
  | "layout-failed"
  | "has-errors"
  | "has-warnings";

export interface ProposalResult {
  status: ProposalStatus;
  /** True when the proposal is good enough to commit. Determined solely by irErrors. */
  committable: boolean;
  round: number;
  diagnostics: Diagnostic[];
  /** Total errors (errors + warnings), kept for backwards compatibility. */
  errors: number;
  warnings: number;
  /** IR-class errors — the only ones that block commit. */
  irErrors: number;
  /** Geometry-class diagnostics — never block commit but are reported as quality signal. */
  geometryIssues: number;
  readabilityScore: number;
  /** Counts only — never coordinates. The model has no use for geometry. */
  preview?: {
    nodeCount: number;
    edgeCount: number;
    boundaryCount: number;
    tiersUsed: string[];
  };
  /** Set when the loop should stop even though problems remain. */
  exhausted?: { reason: "max-rounds" | "no-improvement"; roundsUsed: number };
}

interface Round {
  ir: ArchitectureIr;
  /** Absent when the round failed before the engine ran. */
  layout?: LayoutResult;
  report: ValidationReport;
  /** IR errors for committability — geometry errors don't block. */
  irErrors: number;
}

export interface SessionOptions {
  measureText?: MeasureText;
}

/**
 * Holds the rounds for one diagram request. Instances are cheap; create one per user
 * request rather than sharing across conversations.
 */
export class ProposalSession {
  private readonly rounds: Round[] = [];
  private bestIrErrors = Number.POSITIVE_INFINITY;
  private bestNodeCount = 0;
  private stalls = 0;

  constructor(private readonly options: SessionOptions = {}) {}

  get roundCount(): number {
    return this.rounds.length;
  }

  /** Last proposal good enough to commit, if any. */
  get committable(): Round | undefined {
    for (let i = this.rounds.length - 1; i >= 0; i -= 1) {
      const round = this.rounds[i]!;
      // Commit when the engine produced geometry. IR/schema errors are reported as warnings,
      // not blockers — the user can apply a partial diagram and refine.
      // layout.ok === false means the engine had issues (unknown refs, etc.) but still ran;
      // layout.state.nodes.size === 0 means it stopped before producing any geometry.
      if (round.layout && round.layout.state.nodes.size > 0) return round;
    }
    return undefined;
  }

  /**
   * Validates, lays out and validates again — without touching the store.
   * Accepts unknown so it can take a raw tool payload.
   */
  propose(input: unknown): ProposalResult {
    const parsed = parseArchitectureIr(input);
    if (!parsed.ok) {
      return {
        status: "schema-invalid",
        committable: false,
        round: this.rounds.length,
        diagnostics: parsed.issues.map((issue) => ({
          code: "ir/schema",
          severity: "error" as const,
          class: "ir" as const,
          message: `${issue.path || "(root)"}: ${issue.message}`,
          subject: { kind: "node" as const, ids: [] },
          supportedFixes: [
            {
              action: "rename-id" as const,
              description: `Correct "${issue.path || "the payload"}" and resend.`,
            },
          ],
        })),
        errors: parsed.issues.length,
        warnings: 0,
        irErrors: parsed.issues.length,
        geometryIssues: 0,
        readabilityScore: 0,
      };
    }

    const ir = parsed.ir;

    // Run the layout engine — structural errors are reported but never block.
    // The engine can still produce useful geometry even when an id is unknown,
    // and the model needs to see partial output to iteratively fix the IR.
    const structural = validateIr(toStructuralInput(ir));

    const layout = layoutDiagram(toLayoutInput(ir), { measureText: this.options.measureText });

    // If the engine ran cleanly, validate geometry for quality signal.
    // If the engine failed, report its failures — but still record the result
    // so the user can inspect what the engine produced before giving up.
    let report: ValidationReport;
    if (layout.ok) {
      const geometric = validateGeometry(layout.state);
      report = {
        diagnostics: [...structural.diagnostics, ...geometric.diagnostics],
        errors: structural.errors + geometric.errors,
        warnings: structural.warnings + geometric.warnings,
        irErrors: structural.irErrors + geometric.irErrors,
        geometryIssues: structural.geometryIssues + geometric.geometryIssues,
        readability: geometric.readability,
      };
    } else {
      report = {
        diagnostics: [
          ...structural.diagnostics,
          ...layout.failures.map((failure) => ({
            code: failure.code,
            severity: "error" as const,
            class: "ir" as const,
            message: failure.message,
            subject: { kind: "node" as const, ids: failure.nodeIds ?? [] },
            supportedFixes: [
              {
                action: "drop-edge" as const,
                description: "Remove or correct the elements named above, then resend.",
              },
            ],
          })),
        ],
        errors: structural.errors + layout.failures.length,
        warnings: structural.warnings,
        irErrors: structural.irErrors + layout.failures.length,
        geometryIssues: structural.geometryIssues,
        readability: { throughVertexRoutes: 0, edgeCrossings: 0, totalEdgeLength: 0, score: 0 },
      };
    }

    return this.record(ir, layout, report);
  }

  /** Alias for `propose`, for the refine tool. Round accounting is identical. */
  refine(input: unknown): ProposalResult {
    return this.propose(input);
  }

  /** Geometry of the committable proposal, for the caller to apply to the store. */
  commit(): LayoutResult | undefined {
    // commit() requires a fully successful layout — geometry must be valid.
    // This is stricter than `committable` (which allows partial layouts for UI feedback).
    const best = this.committable;
    if (!best || !best.layout) return undefined;
    if (best.layout.ok) return best.layout;
    // Partial layout (e.g. unknown endpoint refs) — still usable if nodes exist.
    if (best.layout.state.nodes.size > 0 && best.layout.edges.length > 0) return best.layout;
    return undefined;
  }

  private record(
    ir: ArchitectureIr,
    layout: LayoutResult | undefined,
    report: ValidationReport,
  ): ProposalResult {
    const irErrors = report.irErrors;
    const geometryIssues = report.geometryIssues;

    this.rounds.push({ ir, layout, report, irErrors });

    // Stall detection: track improvement in node count AND irErrors.
    // Reset stalls when EITHER metric improves.
    const nodeCount = layout?.state.nodes.size ?? 0;
    if (nodeCount > this.bestNodeCount) {
      this.bestNodeCount = nodeCount;
      this.stalls = 0;
    }
    if (irErrors < this.bestIrErrors) {
      this.bestIrErrors = irErrors;
      this.stalls = 0;
    } else if (nodeCount <= this.bestNodeCount && irErrors >= this.bestIrErrors) {
      // No improvement in either metric → increment stall counter.
      this.stalls += 1;
    }

    const round = this.rounds.length;

    // Determine status for diagnostics display.
    // Only IR-class errors escalate to "has-errors"; geometry issues alone = "has-warnings".
    const effectiveStatus: ProposalStatus =
      irErrors > 0 ? "has-errors" : geometryIssues > 0 ? "has-warnings" : "ok";

    let exhausted: ProposalResult["exhausted"];
    // Exhaustion fires when the model keeps proposing the same broken input.
    // Check stall limit first — early stopping takes priority over max-rounds.
    if (this.stalls >= STALL_LIMIT) {
      exhausted = { reason: "no-improvement", roundsUsed: round };
    } else if (round >= MAX_ROUNDS) {
      exhausted = { reason: "max-rounds", roundsUsed: round };
    }

    return {
      status: effectiveStatus,
      committable: !!(layout && layout.state.nodes.size > 0),
      round,
      diagnostics: report.diagnostics,
      errors: report.errors,
      warnings: report.warnings,
      irErrors,
      geometryIssues,
      readabilityScore: report.readability.score,
      preview: layout?.state
        ? {
            nodeCount: layout.state.nodes.size,
            edgeCount: layout.state.connections.length,
            boundaryCount: layout.state.boundaries.size,
            tiersUsed: [...new Set([...layout.state.nodes.values()].map((node) => node.tier))],
          }
        : undefined,
      exhausted,
    };
  }
}
