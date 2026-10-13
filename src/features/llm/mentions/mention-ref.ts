/**
 * What a message points at in the diagram. Ids are the source of truth; the
 * `label` is cached for showing the chip and is never sent to the model as is:
 * every ref is resolved against the current diagram when a request is built.
 */
export type MentionRef =
  | { kind: "node"; id: string; label: string }
  | { kind: "edge"; id: string; label: string }
  | { kind: "flow"; id: string; label: string }
  /** The canvas selection, snapshotted when the message was sent. */
  | { kind: "selection"; nodeIds: string[]; label: string }
  | { kind: "diagram"; id: string; label: string };

export type MentionKind = MentionRef["kind"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string");
}

const ID_KINDS: readonly MentionKind[] = ["node", "edge", "flow", "diagram"];

export function isMentionRef(value: unknown): value is MentionRef {
  if (!isRecord(value) || typeof value.label !== "string") return false;
  if (value.kind === "selection") return isStringArray(value.nodeIds);
  return ID_KINDS.some((kind) => kind === value.kind) && typeof value.id === "string";
}

export function isNodeRef(ref: MentionRef): ref is Extract<MentionRef, { kind: "node" }> {
  return ref.kind === "node";
}

export function isEdgeRef(ref: MentionRef): ref is Extract<MentionRef, { kind: "edge" }> {
  return ref.kind === "edge";
}

export function isFlowRef(ref: MentionRef): ref is Extract<MentionRef, { kind: "flow" }> {
  return ref.kind === "flow";
}

export function isSelectionRef(ref: MentionRef): ref is Extract<MentionRef, { kind: "selection" }> {
  return ref.kind === "selection";
}

export function isDiagramRef(ref: MentionRef): ref is Extract<MentionRef, { kind: "diagram" }> {
  return ref.kind === "diagram";
}

/** Stable identity of a ref, for de-duplicating chips. */
export function mentionKey(ref: MentionRef): string {
  return isSelectionRef(ref) ? `selection:${ref.nodeIds.join(",")}` : `${ref.kind}:${ref.id}`;
}
