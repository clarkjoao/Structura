import type { KindTextCapture } from "../kind.types";
import { buildOutline } from "./guided.outline.build";
import { parseOutline } from "./guided.outline.parse";
import { serializeGuidedOutline } from "./guided.outline.serialize";
import { isMermaid, parseMermaid } from "./guided.mermaid.parse";
import { serializeMermaidJourney, serializeMermaidSwimlane } from "./guided.mermaid.serialize";

/**
 * The guided journey outline as the kind's text capture (spec guided-journey-outline),
 * reading and writing Mermaid too (spec guided-mermaid-interchange).
 */
export const guidedTextCapture: KindTextCapture = {
  build: (ctx, text) => {
    const parsed = isMermaid(text) ? parseMermaid(text) : parseOutline(text);
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
  formats: [
    {
      id: "outline",
      label: { key: "diagramKinds.guided.mermaid.formats.outline" },
      serialize: serializeGuidedOutline,
    },
    {
      id: "mermaid-swimlane",
      label: { key: "diagramKinds.guided.mermaid.formats.swimlane" },
      serialize: serializeMermaidSwimlane,
    },
    {
      id: "mermaid-journey",
      label: { key: "diagramKinds.guided.mermaid.formats.journey" },
      serialize: serializeMermaidJourney,
    },
  ],
  syntax: { key: "diagramKinds.guided.outline.syntax" },
  placeholder: { key: "diagramKinds.guided.outline.placeholder" },
};
