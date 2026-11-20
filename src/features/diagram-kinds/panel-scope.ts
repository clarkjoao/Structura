import { FREEHAND_KIND, isKindId } from "@/features/diagram/model/diagram-kind";
import type { KindPolicyInput } from "./kind.types";

/**
 * Whether a contribution scoped with `appliesTo.kinds` applies to a diagram.
 * No scope applies everywhere (today's behaviour). `"freehand"` names diagrams
 * with no kind; a kind diagram matches its kind id in either mode, and also
 * when its kind is not registered here.
 */
export function appliesToDiagramKind(
  kinds: readonly string[] | undefined,
  diagram: KindPolicyInput | null | undefined,
): boolean {
  if (kinds === undefined) return true;
  const kindId = diagram && isKindId(diagram.kind) ? diagram.kind : FREEHAND_KIND;
  return kinds.includes(kindId);
}
