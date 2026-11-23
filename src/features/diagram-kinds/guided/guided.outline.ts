import type { KindTextCapture } from "../kind.types";
import { buildOutline } from "./guided.outline.build";
import { parseOutline } from "./guided.outline.parse";
import {
  serializeGuidedOutline,
  serializeGuidedOutlineWithIds,
  writeGuidedOutline,
} from "./guided.outline.serialize";
import { reconcileOutline } from "./guided.outline.reconcile";
import { serializeGuidedDocument } from "./guided.document";
import { guidedSuggest } from "./guided.suggest";
import type { OutlineError } from "./guided.outline.parse";
import { isMermaid, parseMermaid } from "./guided.mermaid.parse";
import { serializeMermaidJourney, serializeMermaidSwimlane } from "./guided.mermaid.serialize";

/**
 * The guided journey outline as the kind's text capture (spec guided-journey-outline),
 * reading and writing Mermaid too (spec guided-mermaid-interchange).
 */
const textErrors = (errors: readonly OutlineError[]) =>
  errors.map((error) => ({
    line: error.line,
    message: { key: `diagramKinds.guided.outline.errors.${error.code}` },
    ...(error.values ? { values: error.values } : {}),
  }));

export const guidedTextCapture: KindTextCapture = {
  build: (ctx, text) => {
    const parsed = isMermaid(text) ? parseMermaid(text) : parseOutline(text);
    const built = buildOutline(ctx.diagram, parsed, ctx.selectedIds, ctx);
    if ("refused" in built) return built;
    if ("errors" in built) return { errors: textErrors(built.errors) };
    const { added, ...outcome } = built;
    return {
      ...outcome,
      nodeCount: added.steps,
      summary: { key: "diagramKinds.guided.outline.summary" },
      summaryValues: { ...added },
    };
  },
  serialize: serializeGuidedOutline,
  writeBase: (diagram, ctx, options) => writeGuidedOutline(diagram, ctx, options),
  suggest: guidedSuggest,
  reconcile: (ctx, base, edited) => {
    const result = reconcileOutline(ctx.diagram, base, edited, ctx);
    return "errors" in result ? { errors: textErrors(result.errors) } : result;
  },
  formats: [
    {
      id: "outline",
      label: { key: "diagramKinds.guided.mermaid.formats.outline" },
      serialize: serializeGuidedOutline,
    },
    {
      id: "outline-ids",
      label: { key: "diagramKinds.guided.mermaid.formats.outlineIds" },
      serialize: serializeGuidedOutlineWithIds,
    },
    {
      id: "document",
      label: { key: "diagramKinds.guided.document.format" },
      serialize: serializeGuidedDocument,
      download: {
        extension: "md",
        mime: "text/markdown",
        label: { key: "diagramKinds.guided.document.download" },
      },
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
