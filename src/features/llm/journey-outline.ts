import { useDiagramStore } from "@/features/diagram";
import { kindCommandContextFor, resolveKindText } from "@/features/diagram-kinds/context";
import type { KindTextBuild } from "@/features/diagram-kinds/kind.types";
import { kindTextCaptureFor } from "@/features/diagram-kinds/textCapture";

/**
 * The assistant writing a guided journey as an outline (spec
 * guided-journey-outline): one action that adds the whole text, checked against
 * the active diagram the same way the canvas panel checks it.
 */

/** The prompt never carries more of the current journey than this. */
const JOURNEY_OUTLINE_PROMPT_LINES = 300;

export interface JourneyOutlinePayload {
  outline: string;
  afterStepId?: string;
}

function activeDiagram() {
  const state = useDiagramStore.getState();
  return state.activeDiagramId ? state.diagrams[state.activeDiagramId] : undefined;
}

/** The current journey as an outline, when the active diagram is written as text; else null. */
export function currentJourneyOutline(): string | null {
  const diagram = activeDiagram();
  const capture = kindTextCaptureFor(diagram);
  if (!diagram || !capture) return null;
  const lines = capture
    .serialize(diagram, kindCommandContextFor(diagram, []))
    .trimEnd()
    .split("\n");
  if (lines.length <= JOURNEY_OUTLINE_PROMPT_LINES) return lines.join("\n");
  return [
    ...lines.slice(0, JOURNEY_OUTLINE_PROMPT_LINES),
    `# … ${lines.length - JOURNEY_OUTLINE_PROMPT_LINES} more lines not shown`,
  ].join("\n");
}

export type JourneyOutlineCheck =
  { ok: true; build: KindTextBuild } | { ok: false; errors: string[] };

/** Builds the outline against the active diagram without applying it. */
export function checkJourneyOutline(payload: JourneyOutlinePayload): JourneyOutlineCheck {
  const diagram = activeDiagram();
  const capture = kindTextCaptureFor(diagram);
  if (!diagram || !capture)
    return { ok: false, errors: ["The active diagram is not a guided diagram in guided mode."] };
  const selected = payload.afterStepId ? [payload.afterStepId] : [];
  const built = capture.build(kindCommandContextFor(diagram, selected), payload.outline);
  if ("errors" in built)
    return {
      ok: false,
      errors: built.errors.map(
        (error) => `line ${error.line}: ${resolveKindText(error.message, error.values)}`,
      ),
    };
  if ("refused" in built) return { ok: false, errors: [resolveKindText(built.refused)] };
  return { ok: true, build: built };
}

/** Applies the outline as one undo step; the summary says what it added, or why nothing. */
export function applyJourneyOutline(payload: JourneyOutlinePayload): {
  applied: boolean;
  data: { added?: Record<string, string | number>; errors?: string[] };
} {
  const check = checkJourneyOutline(payload);
  if (!check.ok) return { applied: false, data: { errors: check.errors } };
  useDiagramStore.getState().applyKindEdit(check.build.edit);
  return { applied: true, data: { added: { ...(check.build.summaryValues ?? {}) } } };
}
