import { useDiagramStore } from "@/features/diagram/store/diagram.store";
import type { Diagram, Level } from "@/features/diagram/model/diagram.types";
import type { KindEdit } from "@/features/diagram/model/kind-edit.types";
import { kindContextFor } from "./context";
import { getDiagramKind } from "./registry";
import { resolveKindPolicy } from "./policy";
import type { KindIssue } from "./kind.types";

/**
 * The kind operations the UI calls. They read the registry and hand the store
 * plain change sets, so the store never depends on a kind.
 */

/** Merges change sets in order (later entries win per field). */
export function mergeKindEdits(...edits: ReadonlyArray<KindEdit | null | undefined>): KindEdit {
  const out: KindEdit = {};
  for (const edit of edits) {
    if (!edit) continue;
    for (const key of [
      "remove",
      "disconnect",
      "update",
      "move",
      "add",
      "connect",
      "reconnect",
      "reparent",
      "relabel",
      "laneOrientation",
    ] as const) {
      const list = edit[key];
      if (list?.length) (out[key] as unknown[]) = [...((out[key] as unknown[]) ?? []), ...list];
    }
    if (edit.flows) {
      out.flows = {
        set: [...(out.flows?.set ?? []), ...(edit.flows.set ?? [])],
        remove: [...(out.flows?.remove ?? []), ...(edit.flows.remove ?? [])],
      };
    }
    if (edit.kindData !== undefined) out.kindData = edit.kindData;
  }
  return out;
}

/**
 * Creates a diagram of `kindId` with the kind's creation template, as one
 * creation. Returns the diagram and the component to select, if any. An
 * unregistered or non-creatable kind creates a freehand diagram.
 */
export function createKindDiagram(input: {
  name: string;
  level: Level;
  kindId: string | null;
  domain?: string;
  folderId?: string | null;
  description?: string;
}): { diagram: Diagram; selectId: string | null } {
  const store = useDiagramStore.getState();
  const descriptor = input.kindId ? getDiagramKind(input.kindId) : undefined;
  const kind = descriptor?.creatable ? descriptor.id : undefined;
  const created = store.addDiagram(
    input.name,
    input.level,
    input.domain,
    input.folderId,
    input.description,
    kind ? { kind } : undefined,
  );
  if (!descriptor?.creatable || !descriptor.create) {
    return { diagram: created, selectId: null };
  }
  const template = descriptor.create(kindContextFor(created));
  const result = store.applyKindEdit(template.edit, { diagramId: created.id, history: false });
  const diagram = useDiagramStore.getState().diagrams[created.id] ?? created;
  const derived = descriptor.derive?.(diagram, kindContextFor(diagram));
  if (derived) store.applyKindEdit(derived, { diagramId: created.id, history: false });
  const selectId = template.select ? (result.idsByKey[template.select] ?? template.select) : null;
  return { diagram: useDiagramStore.getState().diagrams[created.id] ?? diagram, selectId };
}

/** Switches a kind diagram to the freehand editor. One undo step, nothing moves. */
export function editKindFreehand(diagramId: string): void {
  const diagram = useDiagramStore.getState().diagrams[diagramId];
  if (!diagram || resolveKindPolicy(diagram).type !== "kind") return;
  useDiagramStore.getState().setKindMode(diagramId, "freehand");
}

export type ReturnToKindResult =
  | { ok: true }
  | { ok: false; reason: "unavailable" | "not-kind" }
  | { ok: false; reason: "issues"; issues: KindIssue[] };

/**
 * Returns a kind diagram edited freehand to its kind: runs the conformance
 * check; on a pass, restores the kind's mode with its derivation in one undo
 * step (the arrangement follows from the kind watcher, amending that step); on
 * a failure, changes nothing and returns the issues.
 */
export function returnToKind(diagramId: string): ReturnToKindResult {
  const diagram = useDiagramStore.getState().diagrams[diagramId];
  if (!diagram) return { ok: false, reason: "not-kind" };
  const policy = resolveKindPolicy(diagram);
  if (policy.type === "kind-unavailable") return { ok: false, reason: "unavailable" };
  if (policy.type !== "kind-freehand") return { ok: false, reason: "not-kind" };
  const ctx = kindContextFor(diagram);
  const issues = policy.descriptor.conforms(diagram, ctx);
  if (issues.length > 0) return { ok: false, reason: "issues", issues };
  const derived = policy.descriptor.derive?.(diagram, ctx) ?? undefined;
  useDiagramStore.getState().setKindMode(diagramId, "kind", derived);
  return { ok: true };
}
