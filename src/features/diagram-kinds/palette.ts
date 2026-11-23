import type { FlowNodeShape } from "@/features/diagram/model/component.types";
import { isTextType, COMPONENT_TYPE_NOTE } from "@/features/diagram/model/component-type-constants";
import { isKindActive, resolveKindPolicy } from "./policy";
import type { KindElementRef, KindPolicyInput } from "./kind.types";

/** What a palette entry would insert, as the kind's element list names it. */
export interface PaletteElement {
  type: string;
  flowShape?: FlowNodeShape;
}

/**
 * Whether a diagram's kind offers `element` (spec: the palette offers journey
 * steps only). Without an active kind, or for a kind that lists no elements,
 * everything is offered. Free text and notes stay available as annotations.
 */
export function kindOffersElement(
  diagram: KindPolicyInput | null | undefined,
  element: PaletteElement,
): boolean {
  const policy = resolveKindPolicy(diagram);
  if (!isKindActive(policy) || policy.descriptor.elements.length === 0) return true;
  if (isTextType(element.type) || element.type === COMPONENT_TYPE_NOTE) return true;
  return policy.descriptor.elements.some(
    (ref: KindElementRef) =>
      ref.type === element.type &&
      (ref.flowShape === undefined || ref.flowShape === element.flowShape),
  );
}
