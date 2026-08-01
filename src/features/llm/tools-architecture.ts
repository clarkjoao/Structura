/**
 * Architecture generation tools.
 *
 * These replace hand-placed geometry as the generation path. The model sends semantic
 * intent; the engine derives every coordinate. Nothing here accepts or returns an x or y.
 *
 * `propose` and `commit` are separate so a proposal can be checked before it reaches the
 * canvas: the previous surface mutated the store on every add_node, which is why three
 * rounds of correction produced three partial diagrams instead of one good one.
 */

import { proposeArchitectureParameters } from "@/features/architecture-gen/ir";
import type { LLMTool } from "./types";

export const ARCHITECTURE_TOOLS: LLMTool[] = [
  {
    name: "propose_architecture",
    description:
      "Propose a complete architecture diagram as a semantic IR. Structura measures every " +
      "node, resolves the layout and validates the result, then returns diagnostics — it " +
      "does NOT modify the canvas. Never include coordinates: describe what exists, how it " +
      "is grouped and what talks to what, and let the layout engine place it. Call " +
      "commit_architecture once the proposal comes back clean.",
    parametersSchema: proposeArchitectureParameters(),
  },
  {
    name: "refine_architecture",
    description:
      "Resend a corrected IR after propose_architecture reported problems. Use the " +
      "supportedFixes on each diagnostic: they describe changes in IR terms (move a node to " +
      "another tier, split a boundary, shorten a label). The loop stops after 3 rounds, or " +
      "sooner if two consecutive rounds do not reduce the error count.",
    parametersSchema: proposeArchitectureParameters(),
  },
  {
    name: "commit_architecture",
    description:
      "Apply the last clean proposal to the canvas, in a single transaction. Only valid " +
      "after propose_architecture or refine_architecture reported no errors.",
    parametersSchema: { type: "object", properties: {}, required: [] },
  },
];

export const ARCHITECTURE_TOOL_NAMES = ARCHITECTURE_TOOLS.map((tool) => tool.name);

/** Only commit touches the canvas; propose and refine are pure. */
export const ARCHITECTURE_WRITE_TOOL_NAMES = ["commit_architecture"];

export function isArchitectureTool(name: string): boolean {
  return ARCHITECTURE_TOOL_NAMES.includes(name);
}
