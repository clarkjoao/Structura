import type { DiagramModel } from "@/features/diagram/model/diagram.types";
import type { KindTextCapture } from "./kind.types";
import { isKindActive, resolveKindPolicy } from "./policy";

/**
 * The active kind's text capture (spec guided-journey-outline): only while the
 * diagram is edited as its kind — not freehand, not a kind edited freehand.
 */
export function kindTextCaptureFor(
  diagram: Pick<DiagramModel, "kind" | "kindMode"> | null | undefined,
): KindTextCapture | null {
  const policy = resolveKindPolicy(diagram);
  if (!isKindActive(policy)) return null;
  return policy.descriptor.textCapture ?? null;
}
