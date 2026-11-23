import { useDiagramStore } from "@/features/diagram";
import { kindCommandContextFor, resolveKindText } from "@/features/diagram-kinds/context";
import type {
  KindTextBase,
  KindTextBuild,
  KindTextChange,
} from "@/features/diagram-kinds/kind.types";
import { editForChanges } from "@/features/diagram-kinds/kindEditMerge";
import type { JourneyRevision, PendingNodePreview } from "./types";
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

/**
 * The current journey written whole with its handles (spec guided-assistant-revisions):
 * what the assistant sees, and what a revision it sends is read against. Null when the
 * active diagram's kind cannot reconcile a text.
 */
export function currentJourneyBase(): KindTextBase | null {
  const diagram = activeDiagram();
  const capture = kindTextCaptureFor(diagram);
  if (!diagram || !capture?.writeBase || !capture.reconcile) return null;
  return capture.writeBase(diagram, kindCommandContextFor(diagram, []), { handles: true });
}

/** The current journey as an outline, when the active diagram is written as text; else null. */
export function currentJourneyOutline(
  base: KindTextBase | null = currentJourneyBase(),
): string | null {
  const diagram = activeDiagram();
  const capture = kindTextCaptureFor(diagram);
  if (!diagram || !capture) return null;
  const lines = (base?.text ?? capture.serialize(diagram, kindCommandContextFor(diagram, [])))
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

/** A revision read against the journey the assistant saw, as it stands now. */
function reconcileRevision(base: KindTextBase, outline: string) {
  const diagram = activeDiagram();
  const capture = kindTextCaptureFor(diagram);
  if (!diagram || !capture?.reconcile) return null;
  return { diagram, result: capture.reconcile(kindCommandContextFor(diagram, []), base, outline) };
}

/**
 * Checks a revision the assistant sent (spec guided-assistant-revisions): the
 * revision to review, or the errors to tell back. Changes nothing.
 */
export function checkJourneyRevision(
  base: KindTextBase | null,
  outline: string,
): { ok: true; revision: JourneyRevision } | { ok: false; errors: string[] } {
  if (!base)
    return { ok: false, errors: ["The active diagram is not a guided diagram in guided mode."] };
  const read = reconcileRevision(base, outline);
  if (!read)
    return { ok: false, errors: ["The active diagram is not a guided diagram in guided mode."] };
  if ("errors" in read.result)
    return {
      ok: false,
      errors: read.result.errors.map(
        (error) => `line ${error.line}: ${resolveKindText(error.message, error.values)}`,
      ),
    };
  if (read.result.changes.length === 0)
    return { ok: false, errors: ["The revision changes nothing."] };
  return {
    ok: true,
    revision: {
      base,
      outline,
      initial: read.result.changes.map(({ key, kind, label, values, group, phase, reason }) => ({
        key,
        kind,
        label,
        values,
        ...(group !== undefined && { group }),
        ...(phase !== undefined && { phase }),
        ...(reason !== undefined && { reason }),
      })),
      unticked: [],
    },
  };
}

/** The revision's changes against the journey as it is now; empty when it no longer reads. */
export function currentRevisionChanges(revision: JourneyRevision): KindTextChange[] {
  const read = reconcileRevision(revision.base, revision.outline);
  return read && !("errors" in read.result) ? read.result.changes : [];
}

const groupOf = (change: { key: string; group?: string }) => change.group ?? change.key;

/** Applies the ticked changes of a revision as one undo step; how many were applied. */
export function applyJourneyRevision(revision: JourneyRevision): number {
  const read = reconcileRevision(revision.base, revision.outline);
  if (!read || "errors" in read.result) return 0;
  const unticked = new Set(revision.unticked);
  const keys = new Set(
    read.result.changes.filter((c) => !unticked.has(groupOf(c))).map((c) => c.key),
  );
  if (keys.size === 0) return 0;
  const edit = editForChanges(read.diagram.snapshot.components, read.result.changes, keys);
  useDiagramStore.getState().applyKindEdit(edit);
  return keys.size;
}

/** The canvas preview of a revision: the steps its ticked changes touch, and those it removes. */
export function journeyRevisionPreviews(
  suggestionId: string,
  revision: JourneyRevision,
): PendingNodePreview[] {
  const unticked = new Set(revision.unticked);
  const ticked = currentRevisionChanges(revision).filter((c) => !unticked.has(groupOf(c)));
  const steps = activeDiagram()?.snapshot.components ?? {};
  const isStep = (id: string | null): id is string => id !== null && steps[id] !== undefined;
  const removed = ticked
    .filter((c) => c.kind === "remove")
    .map((c) => c.elementId)
    .filter(isStep);
  const changed = [
    ...new Set(
      ticked
        .filter((c) => c.kind !== "remove")
        .map((c) => c.elementId)
        .filter(isStep),
    ),
  ].filter((id) => !removed.includes(id));
  return [
    { suggestionId, nodeIds: changed, edgeIds: [], tone: "change", toolbars: false },
    { suggestionId, nodeIds: removed, edgeIds: [], tone: "remove", toolbars: false },
  ];
}
