import type { KindTextCapture } from "../kind.types";
import { buildOutline } from "./guided.outline.build";
import { parseOutline } from "./guided.outline.parse";
import { serializeGuidedOutline } from "./guided.outline.serialize";

/** The guided journey outline as the kind's text capture (spec guided-journey-outline). */
export const guidedTextCapture: KindTextCapture = {
  build: (ctx, text) => {
    const parsed = parseOutline(text);
    const built = buildOutline(ctx.diagram, parsed, ctx.selectedIds, ctx);
    if ("refused" in built) return built;
    if ("errors" in built)
      return {
        errors: built.errors.map((error) => ({
          line: error.line,
          message: { key: `diagramKinds.guided.outline.errors.${error.code}` },
          ...(error.values ? { values: error.values } : {}),
        })),
      };
    const { added, ...outcome } = built;
    return {
      ...outcome,
      nodeCount: added.steps,
      summary: { key: "diagramKinds.guided.outline.summary" },
      summaryValues: { ...added },
    };
  },
  serialize: serializeGuidedOutline,
  syntax: { key: "diagramKinds.guided.outline.syntax" },
  placeholder: { key: "diagramKinds.guided.outline.placeholder" },
};
