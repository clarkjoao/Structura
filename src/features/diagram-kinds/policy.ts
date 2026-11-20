import { isKindId } from "@/features/diagram/model/diagram-kind";
import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import { diagramKindsVersion, getDiagramKind } from "./registry";
import type { KindInteraction, KindPolicy, KindPolicyInput } from "./kind.types";

const FREEHAND: KindPolicy = { type: "freehand" };

/** What the canvas allows on a freehand diagram — today's editor. */
export const FREEHAND_INTERACTION: KindInteraction = {
  nodesDraggable: true,
  resizable: true,
  arrangeModeChoice: true,
  recordFlows: true,
};

const cache = new Map<string, { version: number; policy: KindPolicy }>();

/**
 * How the editor treats a diagram (design D3):
 *
 * | Diagram                                   | Policy             |
 * | ----------------------------------------- | ------------------ |
 * | no kind                                   | `freehand`         |
 * | kind registered, no `kindMode`            | `kind`             |
 * | kind registered, `kindMode: "freehand"`   | `kind-freehand`    |
 * | kind not registered                       | `kind-unavailable` |
 *
 * Every feature asks this, never `diagram.kind` directly
 * (`kind-reads.guard.test.ts`). Memoised per kind/mode and registry version.
 */
export function resolveKindPolicy(diagram: KindPolicyInput | null | undefined): KindPolicy {
  if (!diagram || !isKindId(diagram.kind)) return FREEHAND;
  const kindId = diagram.kind;
  const key = `${kindId}\u0000${diagram.kindMode === "freehand" ? "f" : "k"}`;
  const version = diagramKindsVersion();
  const hit = cache.get(key);
  if (hit && hit.version === version) return hit.policy;

  const descriptor = getDiagramKind(kindId);
  const policy: KindPolicy = !descriptor
    ? { type: "kind-unavailable", kindId }
    : diagram.kindMode === "freehand"
      ? { type: "kind-freehand", descriptor }
      : { type: "kind", descriptor };
  cache.set(key, { version, policy });
  return policy;
}

/** The interaction the canvas applies under `policy`. */
export function interactionOf(policy: KindPolicy): KindInteraction {
  return policy.type === "kind" ? policy.descriptor.interaction : FREEHAND_INTERACTION;
}

/** Whether the kind's own editor is active (arrangement, derivation, commands, checks). */
export function isKindActive(policy: KindPolicy): policy is Extract<KindPolicy, { type: "kind" }> {
  return policy.type === "kind";
}

/** The flows the active kind derives (none outside its mode). */
export function kindDerivedFlowIds(
  diagram: (KindPolicyInput & DiagramModel) | null | undefined,
): ReadonlySet<string> {
  const policy = resolveKindPolicy(diagram);
  if (!diagram || !isKindActive(policy)) return EMPTY_IDS;
  return new Set(policy.descriptor.derivedFlowIds?.(diagram) ?? []);
}

const EMPTY_IDS: ReadonlySet<string> = new Set();
