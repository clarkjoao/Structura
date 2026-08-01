/**
 * Executes the architecture tool calls.
 *
 * Owns the proposal session for one conversation and routes the three tools. Only
 * `commit_architecture` reaches the store; propose and refine are pure, which is what lets
 * the model iterate without leaving partial diagrams behind.
 */

import { useDiagramStore } from "@/features/diagram";
import { resolveMeasureText } from "@/lib/layout-engine";
import type { Diagnostic } from "@/lib/validators";
import type {
  ArchitectureApplyResult,
  ArchitecturePayload,
} from "@/features/diagram/store/slices/architecture.slice";
import { toStorePayload } from "./commit";
import { ProposalSession, type ProposalResult } from "./session";

/** The one store capability this executor needs. Injected so tests use an isolated store. */
export type ApplyArchitecture = (payload: ArchitecturePayload) => ArchitectureApplyResult;

export interface ArchitectureToolResult {
  tool: string;
  ok: boolean;
  /** Written for the model: what happened and what to do next. */
  summary: string;
  diagnostics?: Diagnostic[];
  proposal?: ProposalResult;
  applied?: { nodeCount: number; connectionCount: number };
}

/** Compact diagnostic rendering — the model reads this, so it names elements and fixes. */
function describe(diagnostics: readonly Diagnostic[]): string {
  return diagnostics
    .slice(0, 10)
    .map((diagnostic) => {
      const fixes = diagnostic.supportedFixes.map((fix) => fix.description).join(" | ");
      return `- [${diagnostic.severity}] ${diagnostic.code}: ${diagnostic.message}${
        fixes ? ` -> ${fixes}` : ""
      }`;
    })
    .join("\n");
}

function summarise(result: ProposalResult): string {
  const header =
    `Round ${result.round}: ${result.errors} error(s), ${result.warnings} warning(s), ` +
    `readability ${result.readabilityScore}.`;

  if (result.status === "ok") {
    return `${header} Clean — call commit_architecture to apply it.`;
  }

  if (result.committable) {
    return (
      `${header} No errors, so this can be committed as-is; fix the warnings first if they ` +
      `matter.\n${describe(result.diagnostics)}`
    );
  }

  const exhausted = result.exhausted
    ? `\nStopping after ${result.exhausted.roundsUsed} round(s) (${result.exhausted.reason}). ` +
      `Report the remaining problems to the user rather than retrying.`
    : `\nApply the fixes above and call refine_architecture.`;

  return `${header}\n${describe(result.diagnostics)}${exhausted}`;
}

/**
 * One instance per conversation. The session accumulates rounds, which is what the
 * improvement rule needs to see.
 */
export class ArchitectureToolExecutor {
  private session: ProposalSession;
  private readonly applyArchitecture: ApplyArchitecture;

  constructor(applyArchitecture?: ApplyArchitecture) {
    // Canvas-backed measurement in the browser, deterministic approximation elsewhere.
    this.session = new ProposalSession({ measureText: resolveMeasureText() });
    this.applyArchitecture =
      applyArchitecture ?? ((payload) => useDiagramStore.getState().applyArchitecture(payload));
  }

  /** Starts a fresh session — call when the user asks for a different diagram. */
  reset(): void {
    this.session = new ProposalSession({ measureText: resolveMeasureText() });
  }

  execute(tool: string, parameters: Record<string, unknown>): ArchitectureToolResult {
    switch (tool) {
      case "propose_architecture":
      case "refine_architecture": {
        const result = this.session.propose(parameters.ir);
        return {
          tool,
          ok: result.committable,
          summary: summarise(result),
          diagnostics: result.diagnostics,
          proposal: result,
        };
      }

      case "commit_architecture": {
        const layout = this.session.commit();
        if (!layout?.state) {
          return {
            tool,
            ok: false,
            summary:
              "Nothing to commit: no proposal has passed validation yet. Call " +
              "propose_architecture first.",
          };
        }

        const payload = toStorePayload(layout.state);
        const applied = this.applyArchitecture(payload);

        if (applied.createdNodeIds.length === 0) {
          return {
            tool,
            ok: false,
            summary: "Could not commit: no active diagram.",
          };
        }

        return {
          tool,
          ok: true,
          summary:
            `Applied ${applied.createdNodeIds.length} element(s) and ` +
            `${applied.createdConnectionIds.length} connection(s) to the canvas.`,
          applied: {
            nodeCount: applied.createdNodeIds.length,
            connectionCount: applied.createdConnectionIds.length,
          },
        };
      }

      default:
        return { tool, ok: false, summary: `Unknown architecture tool "${tool}".` };
    }
  }
}
